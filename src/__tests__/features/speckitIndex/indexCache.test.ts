/**
 * The definition index cache (FR-015, C-msg-2b, C-msg-2c, C-msg-2h).
 *
 * The store makes three claims that are cheap to break and expensive to notice:
 * the index is keyed by FEATURE ROOT and shared, revisions are monotonic across
 * roots, and the emitted order encodes resolution precedence — first definition
 * wins inside one artifact, and the artifact search order wins across them.
 *
 * File reads go through the VS Code mock, which is what the constitution permits
 * for extraction logic. It explicitly does NOT permit the mock as evidence that
 * the freshness integration works; that lives in the Extension Development Host.
 */

import * as vscode from 'vscode';
import { SpeckitIndexStore } from '../../../features/speckitIndex';
import { discoverFeatureScope } from '../../../features/speckitIndex/discovery';

const FEATURE_ROOT = '/w/specs/001-example-feature';

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

function scopeFor(fsPath: string) {
  return discoverFeatureScope({ fsPath, scheme: 'file' });
}

describe('the index is per feature root and shared (FR-015)', () => {
  it('gathers definitions from every artifact, recursing into subfolders', async () => {
    mountFileSystem({
      [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n',
      [`${FEATURE_ROOT}/tasks.md`]: '- [ ] T042 restore scroll\n',
      [`${FEATURE_ROOT}/contracts/api.contract.md`]: '- **C-read-1**: a read returns\n',
      [`${FEATURE_ROOT}/notes.txt`]: 'not markdown, must be ignored',
    });
    const store = new SpeckitIndexStore();
    const payload = await store.getIndex(scopeFor(`${FEATURE_ROOT}/plan.md`));

    expect(payload.featureRoot).toBe(FEATURE_ROOT);
    expect(payload.definitions.map(site => site.id).sort()).toEqual(['C-read-1', 'FR-001', 'T042']);
  });

  it('serves two documents from one folder the SAME index, built once', async () => {
    // The per-panel alternative means N copies of a 60KB payload and N sets of
    // reads for one folder.
    mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n' });
    const store = new SpeckitIndexStore();
    const first = await store.getIndex(scopeFor(`${FEATURE_ROOT}/plan.md`));
    const readsAfterFirst = (vscode.workspace.fs.readFile as jest.Mock).mock.calls.length;

    const second = await store.getIndex(scopeFor(`${FEATURE_ROOT}/tasks.md`));
    expect(second.revision).toBe(first.revision);
    expect((vscode.workspace.fs.readFile as jest.Mock).mock.calls.length).toBe(readsAfterFirst);
  });

  it('collapses two concurrent first-opens into one set of reads', async () => {
    mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n' });
    const store = new SpeckitIndexStore();
    const [a, b] = await Promise.all([
      store.getIndex(scopeFor(`${FEATURE_ROOT}/plan.md`)),
      store.getIndex(scopeFor(`${FEATURE_ROOT}/tasks.md`)),
    ]);
    expect(a.revision).toBe(b.revision);
    expect((vscode.workspace.fs.readFile as jest.Mock).mock.calls.length).toBe(1);
  });

  it('re-reads after the folder is invalidated, with a higher revision', async () => {
    mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n' });
    const store = new SpeckitIndexStore();
    const first = await store.getIndex(scopeFor(`${FEATURE_ROOT}/plan.md`));

    store.invalidateFile(`${FEATURE_ROOT}/spec.md`);
    mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n- **FR-002**: two\n' });
    const second = await store.getIndex(scopeFor(`${FEATURE_ROOT}/plan.md`));

    expect(second.revision).toBeGreaterThan(first.revision);
    expect(second.definitions.map(site => site.id)).toEqual(['FR-001', 'FR-002']);
  });
});

describe('no feature folder means link nothing (FR-019, C-msg-2b)', () => {
  it('returns a null feature root and no definitions, without reading anything', async () => {
    mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n' });
    const store = new SpeckitIndexStore();
    const payload = await store.getIndex(scopeFor('/w/docs/README.md'));

    expect(payload.featureRoot).toBeNull();
    expect(payload.definitions).toEqual([]);
    expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
  });

  it('still carries a revision, so "told to link nothing" is distinguishable', async () => {
    // From "never heard from the host", which is a different state in the
    // webview and must stay one.
    const store = new SpeckitIndexStore();
    const payload = await store.getIndex(scopeFor('/w/docs/README.md'));
    expect(payload.revision).toBeGreaterThan(0);
  });
});

describe('revisions are monotonic across every root (C-msg-2c)', () => {
  it('never repeats or goes backwards when two folders are indexed in turn', async () => {
    mountFileSystem({
      [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n',
      '/w/specs/002-second-feature/spec.md': '- **FR-004**: four\n',
      '/w/docs/README.md': 'not in a feature folder',
    });
    const store = new SpeckitIndexStore();
    const revisions = [
      (await store.getIndex(scopeFor(`${FEATURE_ROOT}/plan.md`))).revision,
      (await store.getIndex(scopeFor('/w/specs/002-second-feature/tasks.md'))).revision,
      (await store.getIndex(scopeFor('/w/docs/README.md'))).revision,
    ];
    expect(revisions).toEqual([...revisions].sort((a, b) => a - b));
    expect(new Set(revisions).size).toBe(revisions.length);
  });
});

describe('emitted order encodes resolution precedence', () => {
  it('puts the first definition in an artifact ahead of a later duplicate', async () => {
    mountFileSystem({
      [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: the winner\n- **FR-001**: the duplicate\n',
    });
    const store = new SpeckitIndexStore();
    const payload = await store.getIndex(scopeFor(`${FEATURE_ROOT}/plan.md`));
    const first = payload.definitions.find(site => site.id === 'FR-001');
    // The consumer takes the first entry, so ordering is the whole mechanism.
    expect(first?.line).toBe(0);
  });

  it('emits artifacts in a stable order regardless of directory listing order', async () => {
    const files = {
      [`${FEATURE_ROOT}/tasks.md`]: '- [ ] T042 restore scroll\n',
      [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n',
    };
    mountFileSystem(files);
    const first = await new SpeckitIndexStore().getIndex(scopeFor(`${FEATURE_ROOT}/plan.md`));

    mountFileSystem(Object.fromEntries(Object.entries(files).reverse()));
    const second = await new SpeckitIndexStore().getIndex(scopeFor(`${FEATURE_ROOT}/plan.md`));

    expect(first.definitions.map(site => site.id)).toEqual(second.definitions.map(site => site.id));
  });
});

describe('an unreadable artifact degrades quietly (FR-010, SC-007)', () => {
  it('contributes nothing and raises nothing when a read fails', async () => {
    mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n' });
    (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(new Error('EACCES'));
    const store = new SpeckitIndexStore();
    const payload = await store.getIndex(scopeFor(`${FEATURE_ROOT}/plan.md`));

    expect(payload.definitions).toEqual([]);
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
  });

  it('contributes nothing when the folder cannot even be listed', async () => {
    (vscode.workspace.fs.readDirectory as jest.Mock).mockRejectedValue(new Error('EACCES'));
    const store = new SpeckitIndexStore();
    const payload = await store.getIndex(scopeFor(`${FEATURE_ROOT}/plan.md`));
    expect(payload.definitions).toEqual([]);
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  });
});
