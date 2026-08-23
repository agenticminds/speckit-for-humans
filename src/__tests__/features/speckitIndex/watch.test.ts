/**
 * Freshness: the index keeps up while artifacts are edited (FR-025, SC-006).
 *
 * Two mechanisms, and BOTH are required. A document open in the workspace emits
 * change events for its unsaved buffer and never touches disk; a file nobody has
 * open changes on disk and emits no document event at all. Wiring only one of
 * them produces the exact half-working failure quickstart scenario 6 is written
 * to catch.
 *
 * The revision rules are asserted from the host side here: a refresh must always
 * move a root's revision FORWARD, because the webview treats a backwards
 * revision as *link nothing* rather than as continuity (C-msg-2c, C-msg-2d). The
 * webview half of that rule is asserted in
 * `src/__tests__/webview/speckitIdLinks.test.ts`.
 *
 * File reads go through the shared VS Code mock. That is evidence the wiring is
 * correct, NOT evidence the integration works in a live window — T063 covers
 * that in the Extension Development Host.
 */

import * as vscode from 'vscode';
import { mockFileSystemWatchers, type MockFileSystemWatcher } from '../../../__mocks__/vscode';
import { SpeckitIndexStore } from '../../../features/speckitIndex';
import { discoverFeatureScope, type FeatureScope } from '../../../features/speckitIndex/discovery';
import {
  SPECKIT_REFRESH_DEBOUNCE_MS,
  SpeckitFreshnessWatcher,
} from '../../../features/speckitIndex/watch';

const FEATURE_ROOT = '/w/specs/001-example-feature';
const BRIEFS = '/w/specs/briefs';

/** A tiny in-memory file system: absolute path → contents. */
function mountFileSystem(files: Record<string, string>): void {
  (vscode.workspace.fs.readDirectory as jest.Mock).mockImplementation(
    async (uri: { fsPath: string }) => {
      const prefix = uri.fsPath.endsWith('/') ? uri.fsPath : `${uri.fsPath}/`;
      const seen = new Map<string, vscode.FileType>();
      for (const fsPath of Object.keys(files)) {
        if (!fsPath.startsWith(prefix)) {
          continue;
        }
        const rest = fsPath.slice(prefix.length);
        const slash = rest.indexOf('/');
        if (slash === -1) {
          seen.set(rest, vscode.FileType.File);
        } else {
          seen.set(rest.slice(0, slash), vscode.FileType.Directory);
        }
      }
      return [...seen.entries()];
    }
  );
  (vscode.workspace.fs.readFile as jest.Mock).mockImplementation(
    async (uri: { fsPath: string }) => {
      const content = files[uri.fsPath];
      if (content === undefined) {
        throw new Error(`ENOENT ${uri.fsPath}`);
      }
      return Buffer.from(content, 'utf8');
    }
  );
}

function scopeFor(fsPath: string): FeatureScope {
  return discoverFeatureScope({ fsPath, scheme: 'file' });
}

/** The mock's `textDocuments`, typed loosely so a test can populate it. */
function openDocuments(): unknown[] {
  return (vscode.workspace as unknown as { textDocuments: unknown[] }).textDocuments;
}

/**
 * Put a document in the editor with unsaved text, exactly as an open buffer
 * whose contents differ from disk.
 */
function openDocument(fsPath: string, text: string): { setText(next: string): void } {
  let current = text;
  const document = {
    uri: { fsPath, path: fsPath, scheme: 'file' },
    fileName: fsPath,
    languageId: 'markdown',
    isDirty: true,
    getText: () => current,
  };
  openDocuments().push(document);
  return {
    setText(next: string) {
      current = next;
    },
  };
}

/** Fire the workspace-wide document-change listener the watcher registered. */
function emitDocumentChange(fsPath: string): void {
  const calls = (vscode.workspace.onDidChangeTextDocument as jest.Mock).mock.calls;
  const document = openDocuments().find(
    entry => (entry as { uri: { fsPath: string } }).uri.fsPath === fsPath
  );
  for (const [handler] of calls) {
    (handler as (event: unknown) => void)({ document, contentChanges: [{}] });
  }
}

function watchersFor(base: string): MockFileSystemWatcher[] {
  return mockFileSystemWatchers.filter(
    watcher => typeof watcher.pattern !== 'string' && watcher.pattern.base === base
  );
}

/** Let the debounce elapse and the refresh it schedules settle. */
async function settle(watcher: SpeckitFreshnessWatcher): Promise<void> {
  jest.advanceTimersByTime(SPECKIT_REFRESH_DEBOUNCE_MS);
  await watcher.whenIdle();
}

describe('the index keeps up while artifacts are edited (FR-025)', () => {
  let store: SpeckitIndexStore;
  let watcher: SpeckitFreshnessWatcher;
  let changedRoots: string[];

  beforeEach(() => {
    jest.useFakeTimers();
    mockFileSystemWatchers.length = 0;
    openDocuments().length = 0;
    changedRoots = [];
    store = new SpeckitIndexStore();
    watcher = new SpeckitFreshnessWatcher({
      store,
      onFeatureRootChanged: featureRoot => changedRoots.push(featureRoot),
    });
  });

  afterEach(() => {
    watcher.dispose();
    store.dispose();
    openDocuments().length = 0;
    jest.useRealTimers();
  });

  describe('one unfiltered workspace-wide document-change listener (T059)', () => {
    it('registers exactly one, and registers it once for the whole workspace', () => {
      // Not one per panel, and not filtered to a panel's own document: the
      // point of FR-025 is that editing spec.md updates a tasks.md nobody
      // touched, which a per-panel filtered listener can never see.
      expect((vscode.workspace.onDidChangeTextDocument as jest.Mock).mock.calls).toHaveLength(1);

      watcher.watch(scopeFor(`${FEATURE_ROOT}/tasks.md`));
      watcher.watch(scopeFor(`${FEATURE_ROOT}/plan.md`));

      expect((vscode.workspace.onDidChangeTextDocument as jest.Mock).mock.calls).toHaveLength(1);
    });

    it('ignores a change to a document under no watched feature root', async () => {
      mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n' });
      watcher.watch(scopeFor(`${FEATURE_ROOT}/tasks.md`));
      openDocument('/w/docs/README.md', '- **FR-010**: not in a feature folder\n');

      emitDocumentChange('/w/docs/README.md');
      await settle(watcher);

      expect(changedRoots).toEqual([]);
    });
  });

  describe('an unsaved edit in an open document re-indexes (C-msg-2d, SC-006)', () => {
    it('picks up a definition that exists only in the dirty buffer', async () => {
      // Disk still holds the OLD spec.md. If the reader reads disk, this fails
      // — the single most likely defect in this component.
      mountFileSystem({
        [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n',
        [`${FEATURE_ROOT}/tasks.md`]: '- [ ] T001 cites FR-010\n',
      });
      const scope = scopeFor(`${FEATURE_ROOT}/tasks.md`);
      watcher.watch(scope);
      const before = await store.getIndex(scope);
      expect(before.definitions.map(site => site.id)).not.toContain('FR-010');

      openDocument(`${FEATURE_ROOT}/spec.md`, '- **FR-001**: one\n- **FR-010**: added, unsaved\n');
      emitDocumentChange(`${FEATURE_ROOT}/spec.md`);
      await settle(watcher);

      const after = await store.getIndex(scope);
      expect(after.definitions.map(site => site.id)).toContain('FR-010');
      expect(after.revision).toBeGreaterThan(before.revision);
    });

    it('reports the feature root, so every panel under it can be pushed to (C-msg-2f)', async () => {
      mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n' });
      const scope = scopeFor(`${FEATURE_ROOT}/tasks.md`);
      watcher.watch(scope);
      await store.getIndex(scope);

      openDocument(`${FEATURE_ROOT}/spec.md`, '- **FR-001**: one\n- **FR-010**: added\n');
      emitDocumentChange(`${FEATURE_ROOT}/spec.md`);
      await settle(watcher);

      expect(changedRoots).toEqual([FEATURE_ROOT]);
    });

    it('drops a definition again when the edit removes it', async () => {
      mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-010**: defined on disk\n' });
      const scope = scopeFor(`${FEATURE_ROOT}/tasks.md`);
      watcher.watch(scope);
      await store.getIndex(scope);

      const buffer = openDocument(`${FEATURE_ROOT}/spec.md`, '- **FR-011**: renamed, unsaved\n');
      emitDocumentChange(`${FEATURE_ROOT}/spec.md`);
      await settle(watcher);

      const after = await store.getIndex(scope);
      expect(after.definitions.map(site => site.id)).toEqual(['FR-011']);
      buffer.setText('- **FR-010**: defined on disk\n');
    });

    it('never force-opens an artifact to read it', async () => {
      // Preferring an open buffer must not become "open everything". A feature
      // folder holds up to 14 artifacts and the briefs folder many more.
      mountFileSystem({
        [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n',
        [`${FEATURE_ROOT}/plan.md`]: '- **FR-002**: two\n',
      });
      const scope = scopeFor(`${FEATURE_ROOT}/tasks.md`);
      watcher.watch(scope);
      await store.getIndex(scope);

      openDocument(`${FEATURE_ROOT}/spec.md`, '- **FR-001**: one\n- **FR-010**: added\n');
      emitDocumentChange(`${FEATURE_ROOT}/spec.md`);
      await settle(watcher);

      expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
    });
  });

  describe('an on-disk change to an unopened file re-indexes (T060)', () => {
    it('watches the feature root and the briefs folder, and nothing else', () => {
      watcher.watch(scopeFor(`${FEATURE_ROOT}/tasks.md`));

      expect(watchersFor(FEATURE_ROOT)).toHaveLength(1);
      expect(watchersFor(BRIEFS)).toHaveLength(1);
      expect(mockFileSystemWatchers).toHaveLength(2);
      for (const created of mockFileSystemWatchers) {
        expect((created.pattern as { pattern: string }).pattern).toContain('.md');
      }
    });

    it('watches one feature root once, however many of its documents open', () => {
      watcher.watch(scopeFor(`${FEATURE_ROOT}/tasks.md`));
      watcher.watch(scopeFor(`${FEATURE_ROOT}/plan.md`));

      expect(mockFileSystemWatchers).toHaveLength(2);
    });

    it('re-reads a feature-root file changed by something outside the editor', async () => {
      mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n' });
      const scope = scopeFor(`${FEATURE_ROOT}/tasks.md`);
      watcher.watch(scope);
      await store.getIndex(scope);

      // Nobody has this file open, so no document event will ever fire for it.
      mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n- **FR-010**: two\n' });
      watchersFor(FEATURE_ROOT)[0].fire('change', vscode.Uri.file(`${FEATURE_ROOT}/spec.md`));
      await settle(watcher);

      const after = await store.getIndex(scope);
      expect(after.definitions.map(site => site.id)).toContain('FR-010');
      expect(changedRoots).toEqual([FEATURE_ROOT]);
    });

    it('re-reads a briefs file, which lies outside every feature folder (FR-016)', async () => {
      mountFileSystem({
        [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n',
        [`${BRIEFS}/brief.md`]: '- **BR-4** a brief requirement\n',
      });
      const scope = scopeFor(`${FEATURE_ROOT}/tasks.md`);
      watcher.watch(scope);
      await store.getIndex(scope);

      mountFileSystem({
        [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n',
        [`${BRIEFS}/brief.md`]: '- **BR-4** a brief requirement\n- **BR-9** another\n',
      });
      watchersFor(BRIEFS)[0].fire('change', vscode.Uri.file(`${BRIEFS}/brief.md`));
      await settle(watcher);

      const after = await store.getIndex(scope);
      expect(after.definitions.map(site => site.id)).toContain('BR-9');
    });

    it('picks up an artifact that did not exist when the folder was indexed', async () => {
      mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n' });
      const scope = scopeFor(`${FEATURE_ROOT}/tasks.md`);
      watcher.watch(scope);
      await store.getIndex(scope);

      mountFileSystem({
        [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n',
        [`${FEATURE_ROOT}/data-model.md`]: '- **R-029**: brand new file\n',
      });
      watchersFor(FEATURE_ROOT)[0].fire('create', vscode.Uri.file(`${FEATURE_ROOT}/data-model.md`));
      await settle(watcher);

      const after = await store.getIndex(scope);
      expect(after.definitions.map(site => site.id)).toContain('R-029');
    });

    it('forgets the definitions of a deleted artifact', async () => {
      mountFileSystem({
        [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n',
        [`${FEATURE_ROOT}/research.md`]: '- **R-029**: about to vanish\n',
      });
      const scope = scopeFor(`${FEATURE_ROOT}/tasks.md`);
      watcher.watch(scope);
      await store.getIndex(scope);

      mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n' });
      watchersFor(FEATURE_ROOT)[0].fire('delete', vscode.Uri.file(`${FEATURE_ROOT}/research.md`));
      await settle(watcher);

      const after = await store.getIndex(scope);
      expect(after.definitions.map(site => site.id)).not.toContain('R-029');
    });
  });

  describe('re-indexing is debounced at the existing sync cadence (T062)', () => {
    it('uses the same 500ms cadence the editor already syncs at', () => {
      expect(SPECKIT_REFRESH_DEBOUNCE_MS).toBe(500);
    });

    it('collapses a burst of keystrokes into one refresh', async () => {
      mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n' });
      const scope = scopeFor(`${FEATURE_ROOT}/tasks.md`);
      watcher.watch(scope);
      await store.getIndex(scope);
      openDocument(`${FEATURE_ROOT}/spec.md`, '- **FR-001**: one\n- **FR-010**: typing\n');

      for (let keystroke = 0; keystroke < 5; keystroke++) {
        emitDocumentChange(`${FEATURE_ROOT}/spec.md`);
        jest.advanceTimersByTime(SPECKIT_REFRESH_DEBOUNCE_MS / 5);
      }
      expect(changedRoots).toEqual([]);

      await settle(watcher);
      expect(changedRoots).toEqual([FEATURE_ROOT]);
    });

    it('re-extracts only the changed file, not the whole folder', async () => {
      mountFileSystem({
        [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n',
        [`${FEATURE_ROOT}/plan.md`]: '- **FR-002**: two\n',
        [`${FEATURE_ROOT}/tasks.md`]: '- [ ] T001 do a thing\n',
        [`${BRIEFS}/brief.md`]: '- **BR-4** a brief requirement\n',
      });
      const scope = scopeFor(`${FEATURE_ROOT}/tasks.md`);
      watcher.watch(scope);
      await store.getIndex(scope);
      (vscode.workspace.fs.readFile as jest.Mock).mockClear();
      (vscode.workspace.fs.readDirectory as jest.Mock).mockClear();

      watchersFor(FEATURE_ROOT)[0].fire('change', vscode.Uri.file(`${FEATURE_ROOT}/spec.md`));
      await settle(watcher);

      const read = (vscode.workspace.fs.readFile as jest.Mock).mock.calls.map(
        (call: [{ fsPath: string }]) => call[0].fsPath
      );
      expect(read).toEqual([`${FEATURE_ROOT}/spec.md`]);
      // Re-walking the folder would cost more than the whole re-extraction.
      expect(vscode.workspace.fs.readDirectory).not.toHaveBeenCalled();
      // …and the definitions from the files that did NOT change survive.
      const after = await store.getIndex(scope);
      expect(after.definitions.map(site => site.id).sort()).toEqual([
        'BR-4',
        'FR-001',
        'FR-002',
        'T001',
      ]);
    });
  });

  describe('a refresh never sends the revision backwards (C-msg-2c, C-msg-2d)', () => {
    it('moves the revision forward on every refresh, so no push reads as link-nothing', async () => {
      // A backwards revision is treated by the webview as LINK NOTHING rather
      // than as continuity, so a refresh that reused or lowered a number would
      // blank every link in the document it was meant to update.
      mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n' });
      const scope = scopeFor(`${FEATURE_ROOT}/tasks.md`);
      watcher.watch(scope);

      const revisions = [(await store.getIndex(scope)).revision];
      const buffer = openDocument(`${FEATURE_ROOT}/spec.md`, '- **FR-001**: one\n');
      for (const text of [
        '- **FR-001**: one\n- **FR-010**: added\n',
        '- **FR-001**: one\n- **FR-011**: renamed\n',
        '- **FR-001**: one\n',
      ]) {
        buffer.setText(text);
        emitDocumentChange(`${FEATURE_ROOT}/spec.md`);
        await settle(watcher);
        revisions.push((await store.getIndex(scope)).revision);
      }

      expect(revisions).toEqual([...revisions].sort((a, b) => a - b));
      expect(new Set(revisions).size).toBe(revisions.length);
    });
  });

  describe('everything registered is disposed', () => {
    it('disposes the document listener and every file-system watcher', () => {
      const listener = (vscode.workspace.onDidChangeTextDocument as jest.Mock).mock.results[0]
        .value as { dispose: jest.Mock };
      watcher.watch(scopeFor(`${FEATURE_ROOT}/tasks.md`));

      watcher.dispose();

      expect(listener.dispose).toHaveBeenCalled();
      for (const created of mockFileSystemWatchers) {
        expect(created.dispose).toHaveBeenCalled();
      }
    });

    it('leaves no pending debounce timer behind', () => {
      mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n' });
      watcher.watch(scopeFor(`${FEATURE_ROOT}/tasks.md`));
      openDocument(`${FEATURE_ROOT}/spec.md`, '- **FR-001**: one\n- **FR-010**: added\n');
      emitDocumentChange(`${FEATURE_ROOT}/spec.md`);
      expect(jest.getTimerCount()).toBeGreaterThan(0);

      watcher.dispose();

      expect(jest.getTimerCount()).toBe(0);
    });

    it('stops watching a root once its last panel closes', async () => {
      mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n' });
      const scope = scopeFor(`${FEATURE_ROOT}/tasks.md`);
      watcher.watch(scope);
      await store.getIndex(scope);

      watcher.unwatch(FEATURE_ROOT);
      for (const created of mockFileSystemWatchers) {
        expect(created.dispose).toHaveBeenCalled();
      }

      openDocument(`${FEATURE_ROOT}/spec.md`, '- **FR-001**: one\n- **FR-010**: added\n');
      emitDocumentChange(`${FEATURE_ROOT}/spec.md`);
      await settle(watcher);
      expect(changedRoots).toEqual([]);
    });
  });
});
