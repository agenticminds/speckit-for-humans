/**
 * Reveal readiness (C-msg-4d, C-msg-4e).
 *
 * A reveal can arrive in four states, and the plan singles this out as one of
 * the two pieces of work most likely to sink the feature. Panel presence CANNOT
 * be used to infer that a webview can receive a message: the panel is registered
 * immediately after its HTML is assigned and before that HTML's script has
 * loaded. Treating "panel exists" as "panel can receive" produces the failure
 * where the first click works and the second silently does nothing.
 *
 * The bar in every state is the same: delivered exactly once, and never dropped.
 */

import * as vscode from 'vscode';
import type { ExtensionContext, TextDocument, Webview, WebviewPanel } from 'vscode';
import { MarkdownEditorProvider } from '../../editor/MarkdownEditorProvider';

const FEATURE_ROOT = '/w/specs/001-example-feature';
const SPEC = `${FEATURE_ROOT}/spec.md`;

interface Harness {
  provider: MarkdownEditorProvider;
  document: TextDocument;
  webview: { postMessage: jest.Mock };
  panel: WebviewPanel;
}

function createDocument(fsPath: string): TextDocument {
  return {
    getText: jest.fn(() => ''),
    isDirty: false,
    uri: { fsPath, path: fsPath, scheme: 'file', toString: () => `file://${fsPath}` },
  } as unknown as TextDocument;
}

function createHarness(fsPath = SPEC): Harness {
  const provider = new MarkdownEditorProvider({} as ExtensionContext);
  const document = createDocument(fsPath);
  const webview = { postMessage: jest.fn() };
  const panel = { webview } as unknown as WebviewPanel;
  return { provider, document, webview, panel };
}

/** Register a panel the way `resolveCustomTextEditor` does: present, not ready. */
function registerPanel(h: Harness, ready = false): void {
  (
    h.provider as unknown as {
      openPanels: Map<string, { panel: WebviewPanel; document: TextDocument; ready: boolean }>;
    }
  ).openPanels.set(h.document.uri.toString(), {
    panel: h.panel,
    document: h.document,
    ready,
  });
}

function dispatchReveal(h: Harness, id = 'FR-001'): void {
  (
    h.provider as unknown as {
      dispatchSpeckitReveal: (uri: unknown, reveal: unknown) => void;
    }
  ).dispatchSpeckitReveal(h.document.uri, {
    type: 'revealSpeckitDefinition',
    id,
    kind: 'bullet',
  });
}

function sendReady(h: Harness): void {
  (
    h.provider as unknown as {
      handleWebviewMessage: (m: unknown, d: TextDocument, w: Webview) => void;
    }
  ).handleWebviewMessage({ type: 'ready' }, h.document, h.webview as unknown as Webview);
}

/** Every reveal the webview was actually sent, in order. */
function reveals(h: Harness): Array<{ id: string }> {
  return h.webview.postMessage.mock.calls
    .map(call => call[0])
    .filter(message => message?.type === 'revealSpeckitDefinition');
}

beforeEach(() => {
  (vscode.workspace.workspaceFolders as unknown as unknown[]) = [
    { uri: { fsPath: '/w', path: '/w', scheme: 'file' }, name: 'w', index: 0 },
  ];
});

afterEach(() => {
  (vscode.workspace.workspaceFolders as unknown as unknown[] | undefined) = undefined;
});

describe('state 1: no panel registered at all', () => {
  it('queues the reveal rather than dropping it', () => {
    const h = createHarness();
    dispatchReveal(h);
    expect(reveals(h)).toHaveLength(0);
  });

  it('delivers it exactly once when the panel later signals ready', () => {
    const h = createHarness();
    dispatchReveal(h);
    registerPanel(h);
    sendReady(h);
    expect(reveals(h)).toEqual([expect.objectContaining({ id: 'FR-001' })]);
  });

  it('holds at most one reveal per document, latest wins', () => {
    // A queue would replay stale navigations in order when the panel opened.
    const h = createHarness();
    dispatchReveal(h, 'FR-001');
    dispatchReveal(h, 'FR-002');
    dispatchReveal(h, 'T042');
    registerPanel(h);
    sendReady(h);
    expect(reveals(h)).toEqual([expect.objectContaining({ id: 'T042' })]);
  });

  it('discards a reveal for a document that never finished opening', () => {
    // The expiry exists so a queue entry cannot fire minutes later, at random,
    // when an unrelated panel for that URI happens to open.
    const h = createHarness();
    const realNow = Date.now;
    Date.now = () => realNow();
    dispatchReveal(h);
    Date.now = () => realNow() + 60_000;
    try {
      registerPanel(h);
      sendReady(h);
      expect(reveals(h)).toHaveLength(0);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('state 2: panel registered, webview has NOT signalled ready', () => {
  it('does not post into a webview whose script has not loaded', () => {
    // The window this whole design exists for. `postMessage` here goes nowhere,
    // and treating presence as readiness silently loses the navigation.
    const h = createHarness();
    registerPanel(h, false);
    dispatchReveal(h);
    expect(reveals(h)).toHaveLength(0);
  });

  it('delivers it exactly once on ready', () => {
    const h = createHarness();
    registerPanel(h, false);
    dispatchReveal(h);
    sendReady(h);
    expect(reveals(h)).toEqual([expect.objectContaining({ id: 'FR-001' })]);
  });

  it('does not deliver it a second time on a subsequent ready', () => {
    const h = createHarness();
    registerPanel(h, false);
    dispatchReveal(h);
    sendReady(h);
    sendReady(h);
    expect(reveals(h)).toHaveLength(1);
  });
});

describe('state 3: panel registered AND ready', () => {
  it('delivers immediately, with no ready signal needed', () => {
    // `ready` fires once per webview lifetime, so a reveal into an already-open
    // panel can never rely on the flush (C-msg-4e).
    const h = createHarness();
    registerPanel(h, true);
    dispatchReveal(h);
    expect(reveals(h)).toEqual([expect.objectContaining({ id: 'FR-001' })]);
  });

  it('leaves nothing queued, so a later ready cannot replay it', () => {
    const h = createHarness();
    registerPanel(h, true);
    dispatchReveal(h);
    sendReady(h);
    expect(reveals(h)).toHaveLength(1);
  });

  it('delivers a second click too — the predicted failure mode', () => {
    const h = createHarness();
    registerPanel(h, true);
    dispatchReveal(h, 'FR-001');
    dispatchReveal(h, 'FR-002');
    expect(reveals(h).map(reveal => reveal.id)).toEqual(['FR-001', 'FR-002']);
  });
});

describe('state 4: panel was ready, then the webview reloaded', () => {
  it('accepts the second ready signal and stays deliverable', () => {
    // A reloaded webview signals ready again in a fresh script context. Nothing
    // detects the reload; the same two actions — set the flag, flush — cover it.
    const h = createHarness();
    registerPanel(h, true);
    sendReady(h);
    dispatchReveal(h);
    expect(reveals(h)).toEqual([expect.objectContaining({ id: 'FR-001' })]);
  });

  it('flushes a reveal that arrived during the reload window', () => {
    const h = createHarness();
    registerPanel(h, true);
    // The reload wipes the webview's script context; the host learns of it only
    // when ready fires again. Model that by clearing readiness first.
    registerPanel(h, false);
    dispatchReveal(h);
    expect(reveals(h)).toHaveLength(0);
    sendReady(h);
    expect(reveals(h)).toEqual([expect.objectContaining({ id: 'FR-001' })]);
  });

  it('still delivers exactly once after the reload settles', () => {
    const h = createHarness();
    registerPanel(h, false);
    sendReady(h);
    dispatchReveal(h, 'T042');
    sendReady(h);
    expect(reveals(h)).toEqual([expect.objectContaining({ id: 'T042' })]);
  });
});

describe('the reveal message itself (C-msg-4a)', () => {
  it('carries no position and no line number', () => {
    const h = createHarness();
    registerPanel(h, true);
    dispatchReveal(h);
    const reveal = reveals(h)[0] as Record<string, unknown>;
    expect(reveal).not.toHaveProperty('pos');
    expect(reveal).not.toHaveProperty('line');
    expect(Object.keys(reveal).sort()).toEqual(['id', 'kind', 'type']);
  });
});
