/**
 * Initial content delivery (C-msg-4e).
 *
 * The webview builds its editor from exactly one message: `update`. The host
 * posts that message optimistically inside `resolveCustomTextEditor`, in the
 * window the provider itself documents as lossy — the panel exists but its
 * script has not run. The `ready` handshake exists to make delivery reliable,
 * but `updateWebview` caches the payload BEFORE posting it, so an unforced
 * resend on `ready` hits the equality guard and posts nothing. A webview that
 * missed the optimistic push then stays blank for the life of the tab, with no
 * error and no retry — the reported "blank on first open, fine after reopen".
 *
 * The bar: after `ready`, the webview has the document, no matter what happened
 * before it. And the echo guards that stop edit feedback loops stay intact.
 */

import * as vscode from 'vscode';
import type { ExtensionContext, TextDocument, Webview, WebviewPanel } from 'vscode';
import { MarkdownEditorProvider } from '../../editor/MarkdownEditorProvider';

const FEATURE_ROOT = '/w/specs/001-example-feature';
const SPEC = `${FEATURE_ROOT}/spec.md`;
const CONTENT = '# Hello\n';

interface Harness {
  provider: MarkdownEditorProvider;
  document: TextDocument;
  webview: { postMessage: jest.Mock };
  panel: WebviewPanel;
}

function createDocument(fsPath: string, text: string): TextDocument {
  return {
    getText: jest.fn(() => text),
    isDirty: false,
    uri: { fsPath, path: fsPath, scheme: 'file', toString: () => `file://${fsPath}` },
  } as unknown as TextDocument;
}

function createHarness(text = CONTENT, fsPath = SPEC): Harness {
  const provider = new MarkdownEditorProvider({} as ExtensionContext);
  const document = createDocument(fsPath, text);
  const webview = { postMessage: jest.fn() };
  const panel = { webview } as unknown as WebviewPanel;
  return { provider, document, webview, panel };
}

/** Register a panel the way `resolveCustomTextEditor` does: present, not ready. */
function registerPanel(h: Harness): void {
  (
    h.provider as unknown as {
      openPanels: Map<string, { panel: WebviewPanel; document: TextDocument; ready: boolean }>;
    }
  ).openPanels.set(h.document.uri.toString(), {
    panel: h.panel,
    document: h.document,
    ready: false,
  });
}

/** The optimistic pre-ready push from `resolveCustomTextEditor`. */
function preReadyPush(h: Harness): void {
  callUpdateWebview(h);
}

function callUpdateWebview(h: Harness, options?: { force?: boolean }): void {
  (
    h.provider as unknown as {
      updateWebview: (
        doc: TextDocument,
        wv: { postMessage: jest.Mock },
        opts?: { force?: boolean }
      ) => void;
    }
  ).updateWebview(h.document, h.webview, options);
}

function sendMessage(h: Harness, type: string): void {
  (
    h.provider as unknown as {
      handleWebviewMessage: (m: unknown, d: TextDocument, w: Webview) => void;
    }
  ).handleWebviewMessage({ type }, h.document, h.webview as unknown as Webview);
}

/** Every `update` the webview was actually sent, in order. */
function updates(h: Harness): Array<{ content: string }> {
  return h.webview.postMessage.mock.calls
    .map(call => call[0])
    .filter(message => message?.type === 'update');
}

beforeEach(() => {
  (vscode.workspace.workspaceFolders as unknown as unknown[]) = [
    { uri: { fsPath: '/w', path: '/w', scheme: 'file' }, name: 'w', index: 0 },
  ];
});

afterEach(() => {
  (vscode.workspace.workspaceFolders as unknown as unknown[] | undefined) = undefined;
});

describe('ready is the authoritative content send', () => {
  it('resends content even though the pre-ready push already cached it', () => {
    // The regression itself. Before the fix the second call early-returned at
    // the equality guard and the webview only ever saw one update — the one it
    // may never have received.
    const h = createHarness();
    registerPanel(h);
    preReadyPush(h);
    sendMessage(h, 'ready');

    expect(updates(h)).toHaveLength(2);
    expect(updates(h)[1].content).toBe(CONTENT);
  });

  it('delivers content to a webview that missed the pre-ready push', () => {
    // Model the real failure: the first post is swallowed before the webview's
    // message listener exists. Only what arrives after `ready` counts.
    const h = createHarness();
    registerPanel(h);
    h.webview.postMessage.mockImplementationOnce(() => undefined);
    preReadyPush(h);
    h.webview.postMessage.mockClear();

    sendMessage(h, 'ready');

    expect(updates(h)).toEqual([expect.objectContaining({ content: CONTENT })]);
  });

  it('answers a requestContent retry from the webview watchdog', () => {
    const h = createHarness();
    registerPanel(h);
    preReadyPush(h);
    sendMessage(h, 'ready');
    h.webview.postMessage.mockClear();

    sendMessage(h, 'requestContent');

    expect(updates(h)).toEqual([expect.objectContaining({ content: CONTENT })]);
  });

  it('marks the panel ready so later host-initiated messages are not queued', () => {
    const h = createHarness();
    registerPanel(h);
    sendMessage(h, 'ready');

    const panels = (
      h.provider as unknown as {
        openPanels: Map<string, { ready: boolean }>;
      }
    ).openPanels;
    expect(panels.get(h.document.uri.toString())?.ready).toBe(true);
  });
});

describe('the echo guards stay intact for every other caller', () => {
  it('still dedupes an unforced update with unchanged content', () => {
    // This is the `onDidChangeTextDocument` path. `force` must not leak into it,
    // or the edit feedback loop the guard exists to break comes back.
    const h = createHarness();
    callUpdateWebview(h, { force: true });
    h.webview.postMessage.mockClear();

    callUpdateWebview(h);

    expect(updates(h)).toHaveLength(0);
  });

  it('still suppresses an unforced update within 100ms of a webview edit', () => {
    const h = createHarness();
    (h.provider as unknown as { pendingEdits: Map<string, number> }).pendingEdits.set(
      h.document.uri.toString(),
      Date.now()
    );
    (h.provider as unknown as { lastWebviewContent: Map<string, string> }).lastWebviewContent.set(
      h.document.uri.toString(),
      'something else entirely'
    );

    callUpdateWebview(h);

    expect(updates(h)).toHaveLength(0);
  });

  it('sends anyway when forced during that same 100ms window', () => {
    // A webview that just signalled ready cannot be holding unsent edits, so
    // the echo guard has nothing to protect and suppressing here is fatal.
    const h = createHarness();
    (h.provider as unknown as { pendingEdits: Map<string, number> }).pendingEdits.set(
      h.document.uri.toString(),
      Date.now()
    );

    callUpdateWebview(h, { force: true });

    expect(updates(h)).toEqual([expect.objectContaining({ content: CONTENT })]);
  });

  it('records the forced payload so the next unforced call dedupes against it', () => {
    const h = createHarness();
    callUpdateWebview(h, { force: true });

    expect(
      (h.provider as unknown as { lastWebviewContent: Map<string, string> }).lastWebviewContent.get(
        h.document.uri.toString()
      )
    ).toBe(CONTENT);
  });
});
