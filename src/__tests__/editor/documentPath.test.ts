import * as vscode from 'vscode';
import { Position, workspace, ExtensionContext, TextDocument } from 'vscode';
import { MarkdownEditorProvider } from '../../editor/MarkdownEditorProvider';

/**
 * Contract C-msg-1: the `update` message must carry the document's path.
 *
 * Without it the webview cannot work out which spec-kit feature folder it is
 * in, which FR-015, FR-018 and FR-019 all depend on. The webview is sandboxed
 * and has no other way to learn its own path: the one existing route saves the
 * document first, so it is unusable as a probe.
 *
 * C-msg-1a is the reason this file asserts every pre-existing field rather than
 * only the new one. The payload is consumed by a single switch in the webview,
 * and dropping a field there fails silently at runtime.
 */

/** A workspace folder shaped enough for the code under test, cast past the real Uri type. */
function folder(fsPath: string, name: string, index: number) {
  return { uri: { fsPath, path: fsPath, scheme: 'file' }, name, index };
}

function setFolders(folders: ReturnType<typeof folder>[] | undefined) {
  (vscode.workspace.workspaceFolders as unknown as vscode.WorkspaceFolder[] | undefined) =
    folders as unknown as vscode.WorkspaceFolder[] | undefined;
}

function createDocument(content: string, fsPath: string, scheme = 'file') {
  return {
    getText: jest.fn(() => content),
    uri: {
      fsPath,
      path: fsPath,
      scheme,
      toString: () => `${scheme}://${fsPath}`,
    },
    positionAt: jest.fn((offset: number) => new Position(0, offset)),
  };
}

function sendUpdate(document: ReturnType<typeof createDocument>) {
  const provider = new MarkdownEditorProvider({} as ExtensionContext);
  const webview = { postMessage: jest.fn() };
  (
    provider as unknown as {
      updateWebview: (doc: TextDocument, wv: { postMessage: jest.Mock }) => void;
    }
  ).updateWebview(document as unknown as TextDocument, webview);
  expect(webview.postMessage).toHaveBeenCalledTimes(1);
  return webview.postMessage.mock.calls[0][0] as Record<string, unknown>;
}

describe('update payload carries the document path (C-msg-1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setFolders(undefined);
    (workspace.getWorkspaceFolder as jest.Mock).mockReturnValue(undefined);
  });

  afterEach(() => {
    setFolders(undefined);
  });

  it('sends a workspace-relative path when the document is inside a workspace folder', () => {
    setFolders([folder('/repo', 'repo', 0)]);

    const payload = sendUpdate(createDocument('# Doc', '/repo/specs/001-thing/plan.md'));

    expect(payload.documentPath).toBe('specs/001-thing/plan.md');
  });

  it('picks the longest matching folder in a multi-root workspace', () => {
    setFolders([folder('/repo', 'repo', 0), folder('/repo/nested', 'nested', 1)]);

    const payload = sendUpdate(createDocument('# Doc', '/repo/nested/specs/002-x/spec.md'));

    // Resolved against /repo/nested, not /repo — otherwise the feature folder
    // walk starts from the wrong root.
    expect(payload.documentPath).toBe('specs/002-x/spec.md');
  });

  it('falls back to the absolute path when no workspace folder contains the document', () => {
    const payload = sendUpdate(createDocument('# Doc', '/elsewhere/specs/003-y/tasks.md'));

    expect(payload.documentPath).toBe('/elsewhere/specs/003-y/tasks.md');
  });

  it('sends null for an untitled document (C-msg-1b)', () => {
    // FR-019: a document not saved to disk has no feature folder, so nothing in
    // it may be linked. Null is the signal for that.
    const payload = sendUpdate(createDocument('# Draft', 'Untitled-1', 'untitled'));

    expect(payload.documentPath).toBeNull();
  });

  it('sends null for any non-file scheme (C-msg-1b)', () => {
    const payload = sendUpdate(createDocument('# Remote', '/remote/spec.md', 'vscode-vfs'));

    expect(payload.documentPath).toBeNull();
  });

  it('leaves every pre-existing field present and correctly typed (C-msg-1a)', () => {
    const payload = sendUpdate(createDocument('# Doc', '/repo/spec.md'));

    expect(payload.type).toBe('update');
    expect(typeof payload.content).toBe('string');
    expect(typeof payload.skipResizeWarning).toBe('boolean');
    expect(typeof payload.skipAiContextSaveWarning).toBe('boolean');
    expect(typeof payload.imagePath).toBe('string');
    expect(typeof payload.imagePathBase).toBe('string');
    expect(typeof payload.showImageHoverOverlay).toBe('boolean');
    expect(typeof payload.paragraphSpacingBefore).toBe('number');
    expect(typeof payload.paragraphSpacingAfter).toBe('number');
    expect(typeof payload.zoom).toBe('number');
    expect(typeof payload.formattingShortcutsEnabled).toBe('boolean');
    expect(payload.blankLineMode).toBeDefined();
    expect(typeof payload.enableMath).toBe('boolean');
  });
});
