/**
 * Mock VS Code API for unit testing
 *
 * This provides minimal mocks for VS Code APIs used in our extension.
 * For integration tests that need real VS Code, use @vscode/test-electron.
 */

// Type definitions for mocks
export interface MockUri {
  fsPath: string;
  path: string;
  scheme: string;
  toString?: () => string;
  uri?: string;
}

export interface MockRange {
  start: Position;
  end: Position;
}

export interface MockTextDocument {
  getText(range?: MockRange): string;
  languageId: string;
  uri: MockUri;
  fileName: string;
  lineCount: number;
  lineAt(line: number): { text: string; lineNumber: number };
}

export interface MockTextEditor {
  document: MockTextDocument;
  selection: Selection;
  selections: Selection[];
}

// Mock StatusBarItem
export const mockStatusBarItem = {
  text: '',
  tooltip: '',
  command: undefined as string | undefined,
  show: jest.fn(),
  hide: jest.fn(),
  dispose: jest.fn(),
};

// Mock StatusBarAlignment enum
export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

// Mock window API
export const window = {
  createStatusBarItem: jest.fn(() => mockStatusBarItem),
  activeTextEditor: undefined as unknown,
  showErrorMessage: jest.fn(),
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  onDidChangeActiveTextEditor: jest.fn(() => ({ dispose: jest.fn() })),
  onDidChangeTextEditorSelection: jest.fn(() => ({ dispose: jest.fn() })),
  withProgress: jest.fn((_options, task) => {
    return task(
      {
        report: jest.fn(),
      },
      { isCancellationRequested: false, onCancellationRequested: jest.fn() }
    );
  }),
  showSaveDialog: jest.fn(),
  showOpenDialog: jest.fn(),
  setStatusBarMessage: jest.fn(() => ({ dispose: jest.fn() })),
};

// Mock workspace API
/** Mirrors `vscode.FileType`. Needed by anything asserting on `workspace.fs.stat`. */
export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

/**
 * Mirrors `vscode.RelativePattern`. The real class takes a base (a folder Uri,
 * workspace folder, or path string) and a glob, and is the only way to scope a
 * file watcher to a folder that may sit outside the workspace.
 */
export class RelativePattern {
  public baseUri: MockUri;
  public base: string;
  public pattern: string;

  constructor(base: MockUri | { uri: MockUri } | string, pattern: string) {
    // Discriminate on `fsPath`, not on `uri`: MockUri itself declares an
    // optional `uri?: string`, so `'uri' in base` matches both branches.
    let uri: MockUri;
    if (typeof base === 'string') {
      uri = { fsPath: base, path: base, scheme: 'file' };
    } else if ('fsPath' in base) {
      uri = base;
    } else {
      uri = base.uri;
    }
    this.baseUri = uri;
    this.base = uri.fsPath;
    this.pattern = pattern;
  }
}

/** One registered watcher, exposed so tests can fire its events. */
export interface MockFileSystemWatcher {
  pattern: RelativePattern | string;
  onDidCreate: jest.Mock;
  onDidChange: jest.Mock;
  onDidDelete: jest.Mock;
  dispose: jest.Mock;
  /** Invoke every handler registered for the given event. */
  fire: (event: 'create' | 'change' | 'delete', uri: MockUri) => void;
}

/**
 * Every watcher handed out by `workspace.createFileSystemWatcher`, newest last.
 * Tests use this to fire change events without touching the real file system:
 *
 *   const watcher = mockFileSystemWatchers.at(-1)!;
 *   watcher.fire('change', Uri.file('/repo/specs/001-x/spec.md'));
 *
 * Clear it in `beforeEach` to keep tests isolated.
 */
export const mockFileSystemWatchers: MockFileSystemWatcher[] = [];

function createMockFileSystemWatcher(pattern: RelativePattern | string): MockFileSystemWatcher {
  const handlers: Record<string, Array<(uri: MockUri) => void>> = {
    create: [],
    change: [],
    delete: [],
  };
  const register = (event: string) =>
    jest.fn((handler: (uri: MockUri) => void) => {
      handlers[event].push(handler);
      return { dispose: jest.fn() };
    });

  const watcher: MockFileSystemWatcher = {
    pattern,
    onDidCreate: register('create'),
    onDidChange: register('change'),
    onDidDelete: register('delete'),
    dispose: jest.fn(),
    fire: (event, uri) => {
      handlers[event].forEach(handler => handler(uri));
    },
  };
  mockFileSystemWatchers.push(watcher);
  return watcher;
}

export const workspace = {
  onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
  onDidSaveTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
  onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() })),
  getWorkspaceFolder: jest.fn(),
  workspaceFolders: undefined as Array<{ uri: MockUri; name: string; index: number }> | undefined,
  getConfiguration: jest.fn(() => ({
    get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
    update: jest.fn(),
  })),
  applyEdit: jest.fn(async (_edit?: unknown) => true),

  /**
   * Documents currently open in the editor. Populate this to exercise the
   * dirty-buffer branch of a reader: real code checks `textDocuments` first and
   * only falls back to `fs.readFile` when the file is not open, because an open
   * document may hold unsaved edits that disk does not have.
   */
  textDocuments: [] as MockTextDocument[],

  /**
   * Resolves a document, returning an already-open one when present. Prefer
   * populating `textDocuments` over stubbing this, so tests exercise the same
   * lookup the real API performs.
   */
  // Return type is annotated explicitly: this closure reads
  // `workspace.textDocuments` from the object it is being defined in, so
  // TypeScript cannot infer it without circularity (TS7024).
  openTextDocument: jest.fn(
    async (target: MockUri | string): Promise<MockTextDocument | undefined> => {
      const fsPath = typeof target === 'string' ? target : target.fsPath;
      return workspace.textDocuments.find((doc: MockTextDocument) => doc.uri.fsPath === fsPath);
    }
  ),

  /** Glob search. Returns nothing by default; stub per test. */
  findFiles: jest.fn(
    async (_include?: unknown, _exclude?: unknown, _max?: number) => [] as MockUri[]
  ),

  /**
   * File system access. `readFile` returns a `Uint8Array` exactly as the real
   * API does, so code under test must decode it rather than assuming a string.
   */
  fs: {
    readFile: jest.fn(async (_uri: MockUri) => new Uint8Array()),
    stat: jest.fn(async (_uri: MockUri) => ({
      type: FileType.File,
      ctime: 0,
      mtime: 0,
      size: 0,
    })),
    readDirectory: jest.fn(async (_uri: MockUri) => [] as Array<[string, FileType]>),
    writeFile: jest.fn(async (_uri: MockUri, _content: Uint8Array) => undefined),
    createDirectory: jest.fn(async (_uri: MockUri) => undefined),
    delete: jest.fn(async (_uri: MockUri, _options?: unknown) => undefined),
    rename: jest.fn(async (_from: MockUri, _to: MockUri, _options?: unknown) => undefined),
  },

  createFileSystemWatcher: jest.fn((pattern: RelativePattern | string) =>
    createMockFileSystemWatcher(pattern)
  ),
};

// Mock commands API
export const commands = {
  registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
  executeCommand: jest.fn(),
};

// Mock Uri
export const Uri = {
  file: jest.fn((path: string) => ({ fsPath: path, path, scheme: 'file' })),
  parse: jest.fn((uri: string) => ({
    fsPath: uri,
    path: uri,
    uri,
    scheme: 'file',
    toString: () => uri,
  })),
};

// Mock env API
export const env = {
  openExternal: jest.fn(),
};

// Mock ConfigurationTarget enum
export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

// Mock TextDocument
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockTextDocument(content: string, languageId = 'markdown'): any {
  return {
    getText: jest.fn((range?: MockRange) => {
      if (range) {
        // Simplified range extraction
        return content;
      }
      return content;
    }),
    languageId,
    uri: Uri.file('/test/document.md') as MockUri,
    fileName: '/test/document.md',
    lineCount: content.split('\n').length,
    lineAt: jest.fn((line: number) => ({
      text: content.split('\n')[line] || '',
      lineNumber: line,
    })),
  };
}

// Mock Selection
export class Selection {
  constructor(
    public anchor: { line: number; character: number },
    public active: { line: number; character: number }
  ) {}

  get isEmpty(): boolean {
    return this.anchor.line === this.active.line && this.anchor.character === this.active.character;
  }
}

// Mock TextEditor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockTextEditor(document: any, selection?: Selection): any {
  return {
    document,
    selection: selection || new Selection({ line: 0, character: 0 }, { line: 0, character: 0 }),
    selections: [selection || new Selection({ line: 0, character: 0 }, { line: 0, character: 0 })],
  };
}

// Reset all mocks helper
export function resetAllMocks() {
  jest.clearAllMocks();
  mockStatusBarItem.text = '';
  mockStatusBarItem.tooltip = '';
  mockStatusBarItem.command = undefined;
  window.activeTextEditor = undefined;
}

// Default export for module mock
// Minimal Position class
export class Position {
  constructor(
    public line: number,
    public character: number
  ) {}
}

// Tree item + visuals
export class TreeItem {
  public iconPath: ThemeIcon | MockUri | { light: MockUri; dark: MockUri } | undefined;
  public description?: string;
  public command?: { command: string; title: string; arguments?: unknown[] };
  public contextValue?: string;
  constructor(
    public label: string,
    public collapsibleState?: number
  ) {}
}

export class EventEmitter<T> {
  public event = jest.fn(() => ({ dispose: jest.fn() }));
  fire = jest.fn((_data?: T) => {});
  dispose = jest.fn();
}

export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
};

export class ThemeIcon {
  constructor(
    public id: string,
    public color?: ThemeColor
  ) {}
}

export class ThemeColor {
  constructor(public id: string) {}
}

export default {
  window,
  workspace,
  commands,
  Uri,
  StatusBarAlignment,
  ProgressLocation,
  Selection,
  TreeItem,
  EventEmitter,
  TreeItemCollapsibleState,
  ThemeIcon,
  ThemeColor,
};

// Minimal Range class
export class Range {
  constructor(
    public start: Position,
    public end: Position
  ) {}
}

// Minimal WorkspaceEdit mock
export class WorkspaceEdit {
  public replaces: Array<{ uri: MockUri; range: Range; text: string }> = [];

  replace(uri: MockUri, range: Range, text: string) {
    this.replaces.push({ uri, range, text });
  }
}
