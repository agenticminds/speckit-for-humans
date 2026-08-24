/**
 * "Go to Spec-Kit ID" - navigate to an identifier's definition from anywhere.
 *
 * The editor already turns `T042` into a clickable link when you are reading a
 * spec in this editor. That covers reading. It does not cover the case this
 * command exists for: an AI assistant, or a terminal, printing `T042` as plain
 * text in a surface no extension can decorate. There, the only thing you can do
 * with an identifier is select it.
 *
 * So: select it, press the key, land on the definition. No dialog in the common
 * case. A picker only when the answer is genuinely ambiguous or absent, because
 * a command that beeps and leaves you where you were is a command you stop
 * using.
 */

import * as path from 'path';
import * as vscode from 'vscode';

import { discoverFeatureScope, type FeatureScope } from '../speckitIndex/discovery';
import type { SpeckitIndexStore } from '../speckitIndex';
import { isFeatureDirName, orderScopeCandidates, type ScopeCandidate } from './candidates';
import { FEATURE_JSON_RELATIVE_PATH, parseFeatureDirectory } from './featureJson';
import { getLastFeatureRoot } from './lastScope';
import { dedupeDefinitions, matchDefinitions, type LocatedDefinition } from './match';
import { idsFromQuery, pickQueryText } from './query';

export const GO_TO_ID_COMMAND = 'speckitForHumans.goToId';

/** The folder feature directories live in, beside the shared briefs folder. */
const SPECS_DIR = 'specs';

/**
 * What the command needs from the editor provider.
 *
 * An interface rather than the provider itself, so the navigation logic does
 * not drag a 3500-line custom editor into its own tests.
 */
export interface GoToIdHost {
  /** The provider's index store, shared so a warm feature folder stays warm. */
  readonly indexStore: SpeckitIndexStore;
  /** Open the artifact and reveal the definition inside it. */
  revealDefinition(site: {
    id: string;
    fsPath: string;
    kind: string;
    headingText?: string;
  }): Promise<void>;
}

export function registerGoToIdCommand(host: GoToIdHost): vscode.Disposable {
  return vscode.commands.registerCommand(GO_TO_ID_COMMAND, () => runGoToId(host));
}

async function runGoToId(host: GoToIdHost): Promise<void> {
  try {
    const query = pickQueryText(readSelection(), await readClipboard());
    const ids = idsFromQuery(query);

    // Steps 1-3 of the chain: the folders we can name without walking anything.
    // Searched one at a time and abandoned as soon as one of them answers, so
    // the overwhelmingly common case reads a single feature folder.
    const narrow = orderScopeCandidates({
      activeFeatureRoot: activeFeatureRoot(),
      lastFeatureRoot: getLastFeatureRoot(),
      featureJsonRoot: await readFeatureJsonRoot(),
    });

    for (const candidate of narrow) {
      const found = matchDefinitions(await collect(host, candidate), ids);
      if (found.length > 0) {
        await resolve(host, dedupeDefinitions(found), query);
        return;
      }
    }

    // Step 4. Only now is the whole workspace worth walking, and only because
    // the cheap answers all came back empty.
    const wide = orderScopeCandidates({
      allFeatureRoots: await findAllFeatureRoots(),
    }).filter(candidate => !narrow.some(seen => seen.featureRoot === candidate.featureRoot));

    const everything: LocatedDefinition[] = [];
    for (const candidate of wide) {
      everything.push(...(await collect(host, candidate)));
    }
    for (const candidate of narrow) {
      everything.push(...(await collect(host, candidate)));
    }

    const all = dedupeDefinitions(everything);
    const found = dedupeDefinitions(matchDefinitions(all, ids));
    await resolve(host, found.length > 0 ? found : all, query);
  } catch (error) {
    // A navigation keypress must never raise a dialog, for the same reason the
    // link path never does (FR-010, SC-007).
    console.warn('[Speckit] Go to ID failed:', error);
  }
}

/**
 * One clean hit goes straight there. Anything else opens the picker.
 *
 * The picker is seeded with the query so the list arrives already filtered by
 * whatever you copied, which turns the "nothing matched" case from a dead end
 * into a search box that is already half typed.
 */
async function resolve(
  host: GoToIdHost,
  candidates: readonly LocatedDefinition[],
  query: string
): Promise<void> {
  if (candidates.length === 1) {
    await open(host, candidates[0]);
    return;
  }

  if (candidates.length === 0) {
    // Nothing indexed at all - no specs folder, or an empty one. A status bar
    // line rather than a modal: this is information, not a failure to
    // acknowledge.
    vscode.window.setStatusBarMessage('Speckit: no spec-kit identifiers found', 4000);
    return;
  }

  const picked = await showPicker(candidates, query);
  if (picked) {
    await open(host, picked);
  }
}

async function showPicker(
  candidates: readonly LocatedDefinition[],
  query: string
): Promise<LocatedDefinition | undefined> {
  const items = candidates.map(located => ({
    label: located.site.id,
    description: located.site.kind,
    detail: `${vscode.workspace.asRelativePath(located.site.fsPath)}:${located.site.line + 1}`,
    located,
  }));

  const quickPick = vscode.window.createQuickPick<(typeof items)[number]>();
  quickPick.items = items;
  quickPick.placeholder = 'Spec-kit identifier';
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;
  // Seeded, not selected: the list is pre-filtered but a single keystroke
  // replaces the seed, so a bad clipboard costs nothing.
  quickPick.value = query;

  try {
    return await new Promise<LocatedDefinition | undefined>(resolvePicked => {
      quickPick.onDidAccept(() => {
        resolvePicked(quickPick.selectedItems[0]?.located);
        quickPick.hide();
      });
      quickPick.onDidHide(() => resolvePicked(undefined));
      quickPick.show();
    });
  } finally {
    quickPick.dispose();
  }
}

async function open(host: GoToIdHost, located: LocatedDefinition): Promise<void> {
  await host.revealDefinition({
    id: located.site.id,
    fsPath: located.site.fsPath,
    kind: located.site.kind,
    ...(located.site.headingText === undefined ? {} : { headingText: located.site.headingText }),
  });
}

/** Every definition in one feature folder, including any it qualifies. */
async function collect(host: GoToIdHost, candidate: ScopeCandidate): Promise<LocatedDefinition[]> {
  const scope = scopeForRoot(candidate.featureRoot);
  const payload = await host.indexStore.getIndex(scope);
  const located: LocatedDefinition[] = payload.definitions.map(site => ({
    site,
    featureRoot: candidate.featureRoot,
  }));
  for (const qualified of payload.qualified) {
    for (const site of qualified.definitions) {
      located.push({ site, featureRoot: qualified.featureRoot });
    }
  }
  return located;
}

/**
 * A `FeatureScope` for a folder we already know is a feature folder.
 *
 * Built by asking `discoverFeatureScope` about a path inside it rather than by
 * assembling the fields here. Duplicating that arithmetic is how the two drift
 * apart, and the briefs-folder rule in particular is not obvious.
 */
function scopeForRoot(featureRoot: string): FeatureScope {
  return discoverFeatureScope({
    fsPath: path.join(featureRoot, 'spec.md'),
    scheme: 'file',
  });
}

function readSelection(): string {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    return '';
  }
  return editor.document.getText(editor.selection);
}

async function readClipboard(): Promise<string> {
  try {
    return await vscode.env.clipboard.readText();
  } catch {
    // Clipboard access can fail on a headless or locked-down host. That is a
    // reason to fall back to the picker, not to abort the command.
    return '';
  }
}

function activeFeatureRoot(): string | null {
  return discoverFeatureScope(vscode.window.activeTextEditor?.document.uri).featureRoot;
}

/**
 * Spec-kit's `.specify/feature.json` pointer, resolved to an absolute path.
 *
 * The stored value is relative to the project root. Missing, unreadable and
 * malformed all mean the same thing here - no pointer - because the file is
 * gitignored per-checkout state that legitimately does not exist.
 */
async function readFeatureJsonRoot(): Promise<string | null> {
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    let contents: string;
    try {
      const uri = vscode.Uri.joinPath(folder.uri, ...FEATURE_JSON_RELATIVE_PATH.split('/'));
      contents = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
    } catch {
      continue;
    }
    const relative = parseFeatureDirectory(contents);
    if (relative !== null) {
      return path.isAbsolute(relative) ? relative : path.join(folder.uri.fsPath, relative);
    }
  }
  return null;
}

/** Every `NNN-` folder under every workspace folder's `specs/` directory. */
async function findAllFeatureRoots(): Promise<string[]> {
  const roots: string[] = [];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const specsUri = vscode.Uri.joinPath(folder.uri, SPECS_DIR);
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(specsUri);
    } catch {
      // No specs folder in this workspace folder. Normal, not an error.
      continue;
    }
    for (const [name, type] of entries) {
      if (type === vscode.FileType.Directory && isFeatureDirName(name)) {
        roots.push(path.join(specsUri.fsPath, name));
      }
    }
  }
  return roots;
}
