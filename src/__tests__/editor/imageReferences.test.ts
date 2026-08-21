import { MarkdownEditorProvider } from '../../editor/MarkdownEditorProvider';
import * as vscode from 'vscode';

// Uses the shared VS Code mock at src/__mocks__/vscode.ts, wired up by the
// moduleNameMapper in jest.config.js. This file previously declared its own
// inline jest.mock("vscode", ...) factory, which shadowed the shared mock
// entirely and had to re-declare findFiles, openTextDocument and the fs
// methods by hand. The shared mock is now a superset, so there is one
// approach rather than two.

function createMockTextDocument(content: string): Partial<vscode.TextDocument> {
  return {
    getText: jest.fn(() => content),
    uri: {
      scheme: 'file',
      fsPath: '/workspace/docs/doc.md',
      toString: () => 'file:/workspace/docs/doc.md',
    } as vscode.Uri,
    fileName: '/workspace/docs/doc.md',
    lineCount: content.split('\n').length,
  };
}

describe('MarkdownEditorProvider - Image reference lookup', () => {
  let provider: MarkdownEditorProvider;
  let mockWebview: { postMessage: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new MarkdownEditorProvider({
      extensionUri: { fsPath: '/extension' } as vscode.Uri,
      subscriptions: [],
    } as unknown as vscode.ExtensionContext);
    mockWebview = { postMessage: jest.fn() };
  });

  it('returns current file count and other-file references for an image', async () => {
    const document = createMockTextDocument(
      ['# Doc', '![A](./images/cat.png)', '', '![B](./images/cat.png)'].join('\n')
    );

    const files = [
      { fsPath: '/workspace/docs/doc.md', scheme: 'file' },
      { fsPath: '/workspace/docs/other.md', scheme: 'file' },
      { fsPath: '/workspace/README.md', scheme: 'file' },
    ];

    const fileContents = new Map<string, string>([
      ['/workspace/docs/doc.md', (document.getText as jest.Mock)?.() ?? ''],
      ['/workspace/docs/other.md', '![X](./images/cat.png)'],
      ['/workspace/README.md', '![X](docs/images/cat.png)'],
    ]);

    (vscode.workspace.findFiles as jest.Mock).mockResolvedValue(files);
    (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (uri: vscode.Uri) => {
      const text = fileContents.get(uri.fsPath) ?? '';
      return {
        uri,
        getText: () => text,
        lineCount: text.split('\n').length,
      };
    });

    (
      provider as unknown as {
        handleWebviewMessage: (
          message: { type: string; [key: string]: unknown },
          doc: vscode.TextDocument,
          webview: vscode.Webview
        ) => void;
      }
    ).handleWebviewMessage(
      { type: 'getImageReferences', requestId: 'req-1', imagePath: './images/cat.png' },
      document as vscode.TextDocument,
      mockWebview as unknown as vscode.Webview
    );

    // Let the async handler run
    await new Promise<void>(resolve => setImmediate(() => resolve()));

    const response = mockWebview.postMessage.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { type?: string; requestId?: string })?.type === 'imageReferences' &&
        (call[0] as { type?: string; requestId?: string })?.requestId === 'req-1'
    )?.[0];

    expect(response).toBeDefined();
    expect(response.currentFileCount).toBe(2);
    expect(response.otherFiles).toHaveLength(2);
  });
});
