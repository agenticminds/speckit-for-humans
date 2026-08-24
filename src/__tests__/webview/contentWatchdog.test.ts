/**
 * @jest-environment jsdom
 */

/**
 * The webview's content watchdog.
 *
 * `update` is the only message that builds the editor. When it never arrives —
 * the host posted it into the pre-ready window and the flush beat this script's
 * message listener — nothing here retries and nothing reports it, so `#editor`
 * stays an empty div that reads as an empty document. The watchdog re-asks a
 * bounded number of times and then says so in the pane.
 *
 * jsdom rather than the stubbed-`document` harness the sibling webview suites
 * use: `document.readyState` is already 'complete' on import, which is exactly
 * the branch that arms the watchdog, and `showEditorFailure` needs a real DOM to
 * paint into.
 */

// Mock TipTap and related heavy dependencies to avoid DOM requirements
jest.mock('@tiptap/core', () => ({
  Editor: jest.fn(),
  Extension: { create: (config: unknown) => config },
  Node: { create: (config: unknown) => config },
  Mark: { create: (config: unknown) => config },
  mergeAttributes: (...args: unknown[]) => Object.assign({}, ...(args as object[])),
  InputRule: class {
    constructor(config: unknown) {
      Object.assign(this, config as object);
    }
  },
}));
jest.mock('katex', () => ({
  __esModule: true,
  default: { renderToString: jest.fn(() => ''), render: jest.fn() },
  renderToString: jest.fn(() => ''),
  render: jest.fn(),
}));
jest.mock('katex/dist/katex.min.css', () => ({}), { virtual: true });
jest.mock('@tiptap/pm/state', () => ({
  Plugin: class {},
  PluginKey: class {},
}));
jest.mock('@tiptap/pm/view', () => ({
  Decoration: { inline: jest.fn() },
  DecorationSet: { create: jest.fn(), empty: {} },
}));
jest.mock('@tiptap/starter-kit', () => ({ __esModule: true, default: { configure: () => ({}) } }));
jest.mock('@tiptap/markdown', () => ({ Markdown: { configure: () => ({}) } }));
jest.mock('lowlight', () => ({ __esModule: true, lowlight: { registerLanguage: jest.fn() } }));
jest.mock('@tiptap/extension-table', () => ({
  __esModule: true,
  Table: { extend: () => ({ configure: () => ({}) }) },
  TableRow: {},
  TableHeader: {},
  TableCell: {},
}));
jest.mock('@tiptap/extension-list', () => ({
  __esModule: true,
  ListKit: { configure: () => ({}) },
  OrderedList: { extend: (config: unknown) => config },
}));
jest.mock('@tiptap/extension-link', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));
jest.mock('@tiptap/extension-code-block-lowlight', () => ({
  __esModule: true,
  default: { configure: () => ({}) },
}));
jest.mock('./../../webview/extensions/codeBlockWithCopy', () => ({
  CodeBlockWithCopy: { configure: () => ({}) },
}));
jest.mock('./../../webview/extensions/customImage', () => ({
  CustomImage: { configure: () => ({}) },
}));
jest.mock('./../../webview/extensions/mermaid', () => ({ Mermaid: {} }));
jest.mock('./../../webview/extensions/tabIndentation', () => ({ TabIndentation: {} }));
jest.mock('./../../webview/extensions/imageEnterSpacing', () => ({ ImageEnterSpacing: {} }));
jest.mock('./../../webview/extensions/markdownParagraph', () => ({ MarkdownParagraph: {} }));
jest.mock('./../../webview/extensions/blankLinePreservation', () => ({
  BlankLinePreservation: {},
}));
jest.mock('./../../webview/extensions/githubAlerts', () => ({ GitHubAlerts: {} }));
jest.mock('./../../webview/BubbleMenuView', () => ({
  createFormattingToolbar: () => ({}),
  createTableMenu: () => ({}),
  updateToolbarStates: jest.fn(),
}));
jest.mock('./../../webview/features/imageDragDrop', () => ({
  setupImageDragDrop: jest.fn(),
  hasPendingImageSaves: jest.fn(() => false),
  getPendingImageCount: jest.fn(() => 0),
}));
jest.mock('./../../webview/features/tocOverlay', () => ({ toggleTocOverlay: jest.fn() }));
jest.mock('./../../webview/features/searchOverlay', () => ({ toggleSearchOverlay: jest.fn() }));
jest.mock('./../../webview/utils/exportContent', () => ({
  collectExportContent: jest.fn(),
  getDocumentTitle: jest.fn(),
}));
jest.mock('./../../webview/utils/pasteHandler', () => ({
  processPasteContent: jest.fn(() => ({ isImage: false, wasConverted: false, content: '' })),
  parseFencedCode: jest.fn(() => null),
}));
jest.mock('./../../webview/utils/copyMarkdown', () => ({ copySelectionAsMarkdown: jest.fn() }));
jest.mock('./../../webview/utils/outline', () => ({ buildOutlineFromEditor: jest.fn(() => []) }));
jest.mock('./../../webview/utils/scrollToHeading', () => ({ scrollToHeading: jest.fn() }));

// editor.ts is loaded via dynamic import(), so this file would otherwise be a
// global script and its type aliases would collide with the sibling suites'.
export {};

const WATCHDOG_MS = 1500;
const MAX_ATTEMPTS = 3;

type TestingModule = {
  armContentWatchdogForTests: () => void;
  disarmContentWatchdogForTests: () => void;
  resetContentWatchdogForTests: () => void;
  getContentWatchdogAttemptsForTests: () => number;
};

describe('webview content watchdog', () => {
  let testing: TestingModule;
  let postMessage: jest.Mock;
  let warnSpy: jest.SpyInstance;

  const requests = () =>
    postMessage.mock.calls.map(call => call[0]).filter(m => m?.type === 'requestContent');

  const failureText = () => document.querySelector('#editor')?.textContent ?? '';

  beforeEach(async () => {
    jest.resetModules();
    jest.useFakeTimers();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    document.body.innerHTML = '<div id="editor"></div>';
    postMessage = jest.fn();
    (global as unknown as { acquireVsCodeApi: () => Record<string, unknown> }).acquireVsCodeApi =
      () => ({
        postMessage,
        getState: jest.fn(),
        setState: jest.fn(),
      });

    const mod = await import('../../webview/editor');
    testing = mod.__testing as unknown as TestingModule;
    // The module armed the watchdog on import (readyState is already
    // 'complete'). Start each case from a known state.
    testing.resetContentWatchdogForTests();
    postMessage.mockClear();
  });

  afterEach(() => {
    testing.resetContentWatchdogForTests();
    jest.clearAllTimers();
    jest.useRealTimers();
    warnSpy.mockRestore();
  });

  it('re-requests content when no update arrives', () => {
    testing.armContentWatchdogForTests();
    jest.advanceTimersByTime(WATCHDOG_MS);

    expect(requests()).toEqual([{ type: 'requestContent' }]);
  });

  it('stays quiet once content has arrived', () => {
    testing.armContentWatchdogForTests();
    testing.disarmContentWatchdogForTests();

    jest.advanceTimersByTime(WATCHDOG_MS * (MAX_ATTEMPTS + 2));

    expect(requests()).toHaveLength(0);
  });

  it('gives up after a bounded number of attempts', () => {
    testing.armContentWatchdogForTests();
    jest.advanceTimersByTime(WATCHDOG_MS * (MAX_ATTEMPTS + 3));

    expect(requests()).toHaveLength(MAX_ATTEMPTS);
    expect(testing.getContentWatchdogAttemptsForTests()).toBe(MAX_ATTEMPTS + 1);
  });

  it('reports the failure in the pane instead of leaving it blank', () => {
    testing.armContentWatchdogForTests();
    jest.advanceTimersByTime(WATCHDOG_MS * (MAX_ATTEMPTS + 1));

    expect(failureText()).toContain('Could not load this document');
  });

  it('leaves no pending timer behind', () => {
    testing.armContentWatchdogForTests();
    jest.advanceTimersByTime(WATCHDOG_MS * (MAX_ATTEMPTS + 1));

    expect(jest.getTimerCount()).toBe(0);
  });

  it('arming twice does not double the retries', () => {
    testing.armContentWatchdogForTests();
    testing.armContentWatchdogForTests();

    jest.advanceTimersByTime(WATCHDOG_MS);

    expect(requests()).toHaveLength(1);
  });
});
