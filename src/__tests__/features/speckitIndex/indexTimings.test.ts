/**
 * The index records its stages separately (T065, SC-009).
 *
 * No threshold is asserted — SC-009 sets none, deliberately. What is asserted
 * is that a build and a refresh each leave behind READ, EXTRACT and RESOLVE as
 * three distinct figures. A combined number would hide which one regressed, and
 * the budget analysis says the two halves behave completely differently: 3.5ms
 * of extraction for the largest real folder against reads whose cost depends on
 * whether the artifact is on a local disk, a network drive, or a container
 * mount.
 */

import * as vscode from 'vscode';
import { SpeckitIndexStore } from '../../../features/speckitIndex';
import { discoverFeatureScope } from '../../../features/speckitIndex/discovery';
import { hostStageTimings } from '../../../shared/perf/stageTimings';

const FEATURE_ROOT = '/w/specs/001-example-feature';

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
        seen.set(
          slash === -1 ? rest : rest.slice(0, slash),
          slash === -1 ? vscode.FileType.File : vscode.FileType.Directory
        );
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

beforeEach(() => {
  hostStageTimings.reset();
});

afterAll(() => {
  hostStageTimings.reset();
});

describe('building an index', () => {
  it('records read, extract and resolve as three separate stages', async () => {
    mountFileSystem({
      [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n',
      [`${FEATURE_ROOT}/tasks.md`]: '- [ ] T042 restore scroll\n',
    });

    await new SpeckitIndexStore().getIndex(scopeFor(`${FEATURE_ROOT}/plan.md`));

    const snapshot = hostStageTimings.snapshot();
    expect(snapshot.read?.calls).toBe(2);
    expect(snapshot.extract?.calls).toBe(2);
    expect(snapshot.resolve?.calls).toBe(1);
  });

  it('counts a read that failed, so an unreadable artifact is still attributable', async () => {
    // The folder listing names a file the reader cannot open. Extraction never
    // runs for it, and the read must still be counted — otherwise a folder full
    // of permission errors looks free.
    mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n' });
    (vscode.workspace.fs.readDirectory as jest.Mock).mockImplementation(
      async (uri: { fsPath: string }) =>
        uri.fsPath === FEATURE_ROOT
          ? [
              ['spec.md', vscode.FileType.File],
              ['gone.md', vscode.FileType.File],
            ]
          : []
    );

    await new SpeckitIndexStore().getIndex(scopeFor(`${FEATURE_ROOT}/plan.md`));

    const snapshot = hostStageTimings.snapshot();
    expect(snapshot.read?.calls).toBe(2);
    expect(snapshot.extract?.calls).toBe(1);
  });
});

describe('refreshing one artifact', () => {
  it('records exactly one read and one extraction, not a whole rebuild', async () => {
    mountFileSystem({
      [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n',
      [`${FEATURE_ROOT}/tasks.md`]: '- [ ] T042 restore scroll\n',
    });
    const store = new SpeckitIndexStore();
    await store.getIndex(scopeFor(`${FEATURE_ROOT}/plan.md`));

    hostStageTimings.reset();
    await store.refreshFile(`${FEATURE_ROOT}/spec.md`);

    const snapshot = hostStageTimings.snapshot();
    expect(snapshot.read?.calls).toBe(1);
    expect(snapshot.extract?.calls).toBe(1);
    expect(snapshot.resolve?.calls).toBe(1);
  });

  it('records nothing for a path no index has ever held', async () => {
    mountFileSystem({ [`${FEATURE_ROOT}/spec.md`]: '- **FR-001**: one\n' });
    const store = new SpeckitIndexStore();
    await store.getIndex(scopeFor(`${FEATURE_ROOT}/plan.md`));

    hostStageTimings.reset();
    await store.refreshFile('/w/elsewhere/notes.md');

    expect(hostStageTimings.snapshot()).toEqual({});
  });
});
