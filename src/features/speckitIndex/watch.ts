/**
 * Freshness: keeping the definition index in step with the artifacts (FR-025).
 *
 * Two sources of change, and both are needed. Neither covers the other:
 *
 * - **Unsaved edits.** `workspace.onDidChangeTextDocument` fires for a buffer
 *   the user is typing into, before anything reaches disk. This is the scenario
 *   the spec actually specifies — type `- **FR-010**: …` into `spec.md` and the
 *   `FR-010` in an untouched `tasks.md` becomes a link.
 * - **On-disk changes.** A `git checkout` or an agent rewriting a file emits NO
 *   document event when nobody has that file open. Only a file-system watcher
 *   sees it.
 *
 * There is exactly ONE document-change listener here, workspace-wide and
 * unfiltered, following `src/features/wordCount.ts`. The per-panel listener in
 * `MarkdownEditorProvider` is filtered to its own document by design; extending
 * it could never satisfy FR-025, whose whole point is that editing one document
 * updates a different one.
 *
 * Extension host only.
 */

import * as vscode from 'vscode';
import type { SpeckitIndexStore } from './index';
import { isWithinFeatureScope, type FeatureScope } from './discovery';

/**
 * How long to wait after the last change before re-indexing.
 *
 * The editor's own webview↔document sync already debounces at 500ms
 * (`DEBOUNCE_SYNC_MS` in `src/webview/editor.ts`). Re-indexing on the same
 * cadence means a keystroke costs at most one extra pass over one file, and the
 * refresh lands inside the two-second budget SC-006 sets. A shorter window
 * re-extracts mid-word for no visible gain; a longer one is a user-visible lag.
 */
export const SPECKIT_REFRESH_DEBOUNCE_MS = 500;

/** Markdown anywhere under a watched root. Contracts live one level down. */
const MARKDOWN_GLOB = '**/*.md';

export interface SpeckitWatchOptions {
  readonly store: Pick<SpeckitIndexStore, 'refreshFile'>;
  /**
   * Called once per refresh, per feature root whose index actually changed.
   *
   * The provider answers it by pushing to EVERY panel under that root, not just
   * the active one — that is what makes a background `tasks.md` update with no
   * user action (C-msg-2f).
   */
  readonly onFeatureRootChanged: (featureRoot: string) => void;
  /** Overridable so a test need not wait real time. */
  readonly debounceMs?: number;
}

/** One watched feature root: its scope, and the watchers standing over it. */
interface WatchedRoot {
  readonly scope: FeatureScope;
  readonly watchers: vscode.FileSystemWatcher[];
}

export class SpeckitFreshnessWatcher implements vscode.Disposable {
  private readonly watched = new Map<string, WatchedRoot>();
  private readonly listener: vscode.Disposable;
  private readonly debounceMs: number;
  /** Paths changed since the last flush, deduplicated. */
  private readonly pending = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  /**
   * The refresh chain. Flushes are serialised rather than run concurrently: two
   * overlapping refreshes of one root would race on the same cached file map.
   */
  private inFlight: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(private readonly options: SpeckitWatchOptions) {
    this.debounceMs = options.debounceMs ?? SPECKIT_REFRESH_DEBOUNCE_MS;
    // ONE listener, for the whole workspace, registered once. Not per panel:
    // N panels would mean N refreshes of the same file per keystroke.
    this.listener = vscode.workspace.onDidChangeTextDocument(event =>
      this.onChanged(event?.document?.uri)
    );
  }

  /**
   * Begin watching the artifacts a scope can resolve against. Idempotent: the
   * second document opened from one feature folder adds no watchers.
   */
  watch(scope: FeatureScope): void {
    const featureRoot = scope.featureRoot;
    if (this.disposed || !featureRoot || this.watched.has(featureRoot)) {
      return;
    }

    // The briefs folder is a SIBLING of the feature folder, so a watcher rooted
    // at the feature folder never sees it, and `BR-`, `AD-` and `OQ-` would go
    // stale the moment anyone edited them outside the editor (FR-016). A folder
    // that does not exist simply never fires.
    const roots = [featureRoot, scope.briefsDir].filter(
      (root): root is string => typeof root === 'string' && root !== ''
    );
    const watchers = roots.map(root => {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(root), MARKDOWN_GLOB)
      );
      // Create and delete matter as much as change: a new artifact defines
      // identifiers the index has never seen, and a deleted one must stop
      // defining them.
      watcher.onDidCreate(uri => this.onChanged(uri));
      watcher.onDidChange(uri => this.onChanged(uri));
      watcher.onDidDelete(uri => this.onChanged(uri));
      return watcher;
    });

    this.watched.set(featureRoot, { scope, watchers });
  }

  /** Stop watching a root, once no panel is showing a document under it. */
  unwatch(featureRoot: string): void {
    const entry = this.watched.get(featureRoot);
    if (!entry) {
      return;
    }
    this.watched.delete(featureRoot);
    entry.watchers.forEach(watcher => watcher.dispose());
  }

  /**
   * Resolves once no refresh is outstanding.
   *
   * Exists for tests, which advance a fake clock and then need the asynchronous
   * re-read the timer started to have finished before asserting.
   */
  async whenIdle(): Promise<void> {
    let settled: Promise<void>;
    do {
      settled = this.inFlight;
      await settled;
    } while (settled !== this.inFlight);
  }

  dispose(): void {
    this.disposed = true;
    this.cancelTimer();
    this.pending.clear();
    this.listener.dispose();
    for (const featureRoot of [...this.watched.keys()]) {
      this.unwatch(featureRoot);
    }
  }

  /**
   * Note a changed artifact, if any watched root could resolve against it.
   *
   * Containment is decided by `isWithinFeatureScope`, the same gate the reveal
   * path uses, so a watcher event and a navigation request cannot disagree
   * about what belongs to a feature.
   */
  private onChanged(uri: { fsPath?: string; scheme?: string } | undefined): void {
    if (this.disposed || !uri || uri.scheme !== 'file' || typeof uri.fsPath !== 'string') {
      return;
    }
    const fsPath = uri.fsPath;
    if (!fsPath.toLowerCase().endsWith('.md')) {
      return;
    }
    const relevant = [...this.watched.values()].some(entry =>
      isWithinFeatureScope(fsPath, entry.scope)
    );
    if (!relevant) {
      return;
    }

    this.pending.add(fsPath);
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.flush();
    }, this.debounceMs);
  }

  private cancelTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private flush(): void {
    const paths = [...this.pending];
    this.pending.clear();
    if (paths.length === 0) {
      return;
    }
    this.inFlight = this.inFlight.then(() => this.refresh(paths));
  }

  private async refresh(paths: readonly string[]): Promise<void> {
    // Deduplicated across the batch: two artifacts in one folder changing
    // together is one push, not two.
    const roots = new Set<string>();
    for (const fsPath of paths) {
      try {
        for (const featureRoot of await this.options.store.refreshFile(fsPath)) {
          roots.add(featureRoot);
        }
      } catch (error) {
        // An unreadable artifact degrades to "that identifier is undefined",
        // never to a dialog (FR-010, SC-007).
        console.warn('[Speckit] Spec-kit index refresh failed:', error);
      }
    }

    if (this.disposed) {
      return;
    }
    for (const featureRoot of roots) {
      // Only roots something still watches: a panel closed mid-refresh has
      // nothing to push to.
      if (this.watched.has(featureRoot)) {
        this.options.onFeatureRootChanged(featureRoot);
      }
    }
  }
}
