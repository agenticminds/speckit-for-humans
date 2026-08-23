/** @jest-environment jsdom */

/**
 * Zero interruptions (FR-010, SC-007). **Enforced gate.**
 *
 * An identifier that cannot be resolved must produce ordinary prose and
 * nothing else: no link, no "broken reference" styling, no dialog, no warning,
 * no badge. This is the requirement most at risk from reuse, because the
 * handler the design reuses everything else from — the local-file link branch —
 * pops a *File not found* dialog on a miss. The last test here proves that
 * handler still behaves that way, so the assertions above it mean something:
 * the new path genuinely never reaches it.
 *
 * Three failure modes are covered, matching the three ways a reference can go
 * bad in practice:
 *   1. the identifier resolves to nothing at all;
 *   2. the index is stale and names a file that has since been deleted;
 *   3. the recorded path does not resolve, or escapes the feature scope.
 */

import * as vscode from 'vscode';
import type { ExtensionContext, TextDocument } from 'vscode';
import type { Editor } from '@tiptap/core';
import { MarkdownEditorProvider } from '../../editor/MarkdownEditorProvider';
import {
  createSpeckitEditor,
  speckitLinkElements,
  speckitLinkedIds,
} from './helpers/speckitEditorHarness';
import { applySpeckitIndex, resetSpeckitIndex } from '../../webview/extensions/speckitIdLinks';
import { setDocumentPath, resetDocumentPath } from '../../webview/utils/documentPath';
import type { DefinitionSite } from '../../features/speckitIndex/extract';

const FEATURE_ROOT = '/w/specs/001-example-feature';

function definition(id: string, file: string, kind: DefinitionSite['kind'] = 'bullet') {
  return { id, fsPath: `${FEATURE_ROOT}/${file}`, line: 3, kind };
}

function createDocument(fsPath: string) {
  return {
    getText: jest.fn(() => ''),
    isDirty: false,
    uri: { fsPath, path: fsPath, scheme: 'file', toString: () => `file://${fsPath}` },
  } as unknown as TextDocument;
}

/** Every route by which this extension could interrupt somebody. */
function interruptions(): number {
  const win = vscode.window as unknown as Record<string, jest.Mock>;
  return (
    win.showErrorMessage.mock.calls.length +
    win.showWarningMessage.mock.calls.length +
    win.showInformationMessage.mock.calls.length
  );
}

async function openDefinition(
  provider: MarkdownEditorProvider,
  document: TextDocument,
  message: Record<string, unknown>
): Promise<void> {
  await (
    provider as unknown as {
      handleOpenSpeckitDefinition: (m: Record<string, unknown>, d: TextDocument) => Promise<void>;
    }
  ).handleOpenSpeckitDefinition({ type: 'openSpeckitDefinition', ...message }, document);
}

describe('an unresolvable identifier is plain prose, silently (FR-010)', () => {
  let editor: Editor | undefined;

  beforeEach(() => {
    resetSpeckitIndex();
    resetDocumentPath();
    setDocumentPath('specs/001-example-feature/plan.md');
  });

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
    resetSpeckitIndex();
    resetDocumentPath();
  });

  it('produces no link element and therefore nothing to click', () => {
    applySpeckitIndex({ revision: 1, featureRoot: FEATURE_ROOT, definitions: [] });
    editor = createSpeckitEditor('The withdrawn FR-015 is still referenced here.');
    expect(speckitLinkedIds(editor)).toEqual([]);
    expect(speckitLinkElements(editor)).toEqual([]);
  });

  it('gives it no distinguishing styling either — it is ordinary text', () => {
    applySpeckitIndex({ revision: 1, featureRoot: FEATURE_ROOT, definitions: [] });
    editor = createSpeckitEditor('The withdrawn FR-015 is still referenced here.');
    expect(editor.view.dom.querySelectorAll('[class*="speckit"]')).toHaveLength(0);
    expect(editor.view.dom.textContent).toContain('FR-015');
  });
});

describe('the host never interrupts on a bad target (SC-007)', () => {
  let provider: MarkdownEditorProvider;
  let document: TextDocument;

  beforeEach(() => {
    provider = new MarkdownEditorProvider({} as ExtensionContext);
    document = createDocument(`${FEATURE_ROOT}/plan.md`);
    (vscode.workspace.workspaceFolders as unknown as unknown[]) = [
      { uri: { fsPath: '/w', path: '/w', scheme: 'file' }, name: 'w', index: 0 },
    ];
  });

  afterEach(() => {
    (vscode.workspace.workspaceFolders as unknown as unknown[] | undefined) = undefined;
  });

  it('says nothing when the index is stale and names a deleted file', async () => {
    (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error('ENOENT'));
    await openDefinition(provider, document, definition('FR-001', 'spec.md'));
    expect(interruptions()).toBe(0);
  });

  it('says nothing when the recorded path does not resolve at all', async () => {
    (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error('ENOENT'));
    await openDefinition(provider, document, {
      id: 'FR-001',
      fsPath: '',
      kind: 'bullet',
    });
    expect(interruptions()).toBe(0);
  });

  it('says nothing when the path escapes the feature scope (C-msg-3e)', async () => {
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: 1 });
    await openDefinition(provider, document, {
      id: 'FR-001',
      fsPath: '../../../../etc/passwd',
      kind: 'bullet',
    });
    expect(interruptions()).toBe(0);
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });

  it('says nothing when the document is in no feature folder at all', async () => {
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: 1 });
    await openDefinition(provider, createDocument('/w/docs/README.md'), {
      id: 'FR-001',
      fsPath: `${FEATURE_ROOT}/spec.md`,
      kind: 'bullet',
    });
    expect(interruptions()).toBe(0);
  });

  it('says nothing when opening the target throws', async () => {
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: 1 });
    (vscode.commands.executeCommand as jest.Mock).mockRejectedValue(new Error('no such editor'));
    await openDefinition(provider, document, definition('FR-001', 'spec.md'));
    expect(interruptions()).toBe(0);
  });
});

describe('the handler this design deliberately bypasses still interrupts', () => {
  it('the local-file link branch raises a File not found dialog on a miss', async () => {
    // Not a description of desired behaviour — a control. If this ever stops
    // raising, the assertions above lose their meaning and must be rewritten.
    const provider = new MarkdownEditorProvider({} as ExtensionContext);
    (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error('ENOENT'));
    await (
      provider as unknown as {
        handleOpenFileLink: (m: Record<string, unknown>, d: TextDocument) => Promise<void>;
      }
    ).handleOpenFileLink(
      { type: 'openFileLink', path: './does-not-exist.md' },
      createDocument(`${FEATURE_ROOT}/plan.md`)
    );
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('File not found')
    );
  });
});
