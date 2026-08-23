/** @jest-environment jsdom */

/**
 * The decoration plugin (FR-005, FR-006, FR-020).
 *
 * A resolved token must gain the editor's EXISTING link class, so it is
 * indistinguishable from an author-written link, plus a data attribute that is
 * the dispatch key for the click branch. It must carry no href: an unrecognised
 * href shape falls through to the local-file branch, which cannot carry a
 * position, opens the plain text editor, and raises a dialog on a miss.
 *
 * Everything here runs against a real TipTap editor with the real markdown
 * manager. A stub view would not prove that the decoration survives parsing.
 */

import type { Editor } from '@tiptap/core';
import {
  createSpeckitEditor,
  speckitLinkElements,
  speckitLinkedIds,
} from './helpers/speckitEditorHarness';
import { applySpeckitIndex, resetSpeckitIndex } from '../../webview/extensions/speckitIdLinks';
import { setDocumentPath, resetDocumentPath } from '../../webview/utils/documentPath';
import type { DefinitionSite } from '../../features/speckitIndex/extract';

const FEATURE_ROOT = '/w/specs/001-example-feature';

function site(
  id: string,
  file = 'spec.md',
  kind: DefinitionSite['kind'] = 'bullet'
): DefinitionSite {
  return { id, fsPath: `${FEATURE_ROOT}/${file}`, line: 0, kind };
}

let revision = 0;

function index(definitions: DefinitionSite[], featureRoot: string | null = FEATURE_ROOT): void {
  applySpeckitIndex({ revision: ++revision, featureRoot, definitions });
}

let editor: Editor | undefined;

beforeEach(() => {
  resetSpeckitIndex();
  resetDocumentPath();
  // The referencing document. Nothing in it is a definition, so nothing here is
  // ever suppressed as a self-reference.
  setDocumentPath('specs/001-example-feature/plan.md');
});

afterEach(() => {
  editor?.destroy();
  editor = undefined;
  resetSpeckitIndex();
  resetDocumentPath();
});

describe('a resolved token gains the existing link class and a data attribute (FR-020)', () => {
  it('decorates a resolvable identifier', () => {
    index([site('FR-001')]);
    editor = createSpeckitEditor('The read path satisfies FR-001 in full.');

    const elements = speckitLinkElements(editor);
    expect(elements).toHaveLength(1);
    expect(elements[0].tagName.toLowerCase()).toBe('a');
    expect(elements[0].classList.contains('markdown-link')).toBe(true);
    expect(elements[0].getAttribute('data-speckit-id')).toBe('FR-001');
    expect(elements[0].textContent).toBe('FR-001');
  });

  it('carries no href, so it can never fall through to the local-file branch', () => {
    index([site('FR-001')]);
    editor = createSpeckitEditor('See FR-001.');
    expect(speckitLinkElements(editor)[0].hasAttribute('href')).toBe(false);
  });

  it('decorates every resolvable occurrence, not just the first', () => {
    index([site('FR-001'), site('T042', 'tasks.md')]);
    editor = createSpeckitEditor('FR-001 and T042 and FR-001 again.');
    expect(speckitLinkedIds(editor)).toEqual(['FR-001', 'T042', 'FR-001']);
  });

  it('leaves an unresolvable identifier as plain prose (FR-010)', () => {
    index([site('FR-001')]);
    editor = createSpeckitEditor('FR-001 is defined; FR-999 is not.');
    expect(speckitLinkedIds(editor)).toEqual(['FR-001']);
  });

  it('links nothing when the document is in no feature folder (FR-019)', () => {
    index([site('FR-001')], null);
    editor = createSpeckitEditor('See FR-001.');
    expect(speckitLinkedIds(editor)).toEqual([]);
  });

  it('links nothing before any index has arrived', () => {
    editor = createSpeckitEditor('See FR-001.');
    expect(speckitLinkedIds(editor)).toEqual([]);
  });
});

describe('code is skipped on the reference side (FR-005)', () => {
  it('does not decorate an identifier inside an inline code span', () => {
    index([site('FR-003')]);
    editor = createSpeckitEditor('Shown as code: `FR-003` and as prose: FR-003.');
    // Exactly one — the prose occurrence. The code span must be untouched.
    expect(speckitLinkedIds(editor)).toEqual(['FR-003']);
    const code = editor.view.dom.querySelector('code');
    expect(code?.querySelector('[data-speckit-id]')).toBeNull();
  });

  it('does not decorate an identifier inside a fenced code block', () => {
    index([site('FR-001')]);
    editor = createSpeckitEditor('```\n- **FR-001**: an example\n```\n\nProse FR-001.');
    expect(speckitLinkedIds(editor)).toEqual(['FR-001']);
    const pre = editor.view.dom.querySelector('pre');
    expect(pre?.querySelector('[data-speckit-id]')).toBeNull();
  });
});

describe('author-written links are left alone (FR-006)', () => {
  it('does not decorate text that already carries a link mark', () => {
    index([site('FR-001')]);
    editor = createSpeckitEditor('An author link: [FR-001](./spec.md).');
    expect(speckitLinkedIds(editor)).toEqual([]);
    // The author's link is untouched and still present.
    const authored = editor.view.dom.querySelector('a[href]');
    expect(authored?.textContent).toBe('FR-001');
  });

  it('still decorates a bare occurrence elsewhere in the same document', () => {
    index([site('FR-001')]);
    editor = createSpeckitEditor('[FR-001](./spec.md) is also written bare as FR-001.');
    expect(speckitLinkedIds(editor)).toEqual(['FR-001']);
  });
});

describe('look-alikes are never decorated (FR-007, SC-003)', () => {
  it.each([
    'The transport uses AES-256 with SHA-256 digests over UTF-8.',
    'Tokens are signed HS256 and the build targets ES2022.',
    'Priority markers such as (Priority: P1) and bare (P2) are not identifiers.',
    'See spec.md:41-58 and the handler at editor.ts:1852.',
    'Error codes PGRST116, TS7016 and P0001 are not identifiers.',
  ])('leaves %s entirely plain', text => {
    index([site('FR-001'), site('T042', 'tasks.md')]);
    editor = createSpeckitEditor(text);
    expect(speckitLinkedIds(editor)).toEqual([]);
  });
});

describe('the plugin never changes the document (FR-024, C-msg-7)', () => {
  it('produces no document-changing transaction when an index arrives', () => {
    editor = createSpeckitEditor('See FR-001.');
    const before = editor.getJSON();
    const docChanges: boolean[] = [];
    editor.on('transaction', ({ transaction }) => docChanges.push(transaction.docChanged));

    index([site('FR-001')]);
    // Applying an index must not be able to start a refresh loop.
    expect(docChanges.every(changed => changed === false)).toBe(true);
    expect(editor.getJSON()).toEqual(before);
    // …but it must still have taken effect on screen.
    expect(speckitLinkedIds(editor)).toEqual(['FR-001']);
  });

  it('ignores a repeated revision (C-msg-2c)', () => {
    editor = createSpeckitEditor('See FR-001.');
    applySpeckitIndex({ revision: 10, featureRoot: FEATURE_ROOT, definitions: [site('FR-001')] });
    expect(speckitLinkedIds(editor)).toEqual(['FR-001']);

    const accepted = applySpeckitIndex({
      revision: 10,
      featureRoot: FEATURE_ROOT,
      definitions: [],
    });
    expect(accepted).toBe(false);
    expect(speckitLinkedIds(editor)).toEqual(['FR-001']);
  });

  it('treats a revision that goes backwards as link-nothing (C-msg-2d)', () => {
    editor = createSpeckitEditor('See FR-001.');
    applySpeckitIndex({ revision: 10, featureRoot: FEATURE_ROOT, definitions: [site('FR-001')] });
    expect(speckitLinkedIds(editor)).toEqual(['FR-001']);

    // Never continuity. A webview can be reloaded even with
    // retainContextWhenHidden, and carrying on with a stale index would present
    // links to definitions that may no longer exist.
    applySpeckitIndex({ revision: 4, featureRoot: FEATURE_ROOT, definitions: [site('FR-001')] });
    expect(speckitLinkedIds(editor)).toEqual([]);
  });
});
