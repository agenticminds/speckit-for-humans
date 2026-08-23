/** @jest-environment jsdom */

/**
 * Exports carry no dead links (T064, quickstart scenario 7).
 *
 * The ID-link decoration is an `<a>` with no `href` and a data attribute. Inside
 * the live editor a click handler keyed on that attribute does the navigating.
 * In a PDF or a Word file nothing reads the attribute, so the same element is a
 * link that goes nowhere. The export sanitizer cannot catch it — it is a
 * denylist that passes `class` and unknown attributes straight through — so the
 * export path has to strip it deliberately.
 *
 * Run against a REAL TipTap editor with the real decoration plugin, not
 * hand-written HTML, because what has to be proven is that the thing production
 * actually emits is the thing the stripper removes.
 */

import type { Editor } from '@tiptap/core';
import { createSpeckitEditor, speckitLinkElements } from './helpers/speckitEditorHarness';
import { applySpeckitIndex, resetSpeckitIndex } from '../../webview/extensions/speckitIdLinks';
import { setDocumentPath, resetDocumentPath } from '../../webview/utils/documentPath';
import { stripSpeckitIdLinks } from '../../webview/utils/exportContent';
import type { DefinitionSite } from '../../features/speckitIndex/extract';

const FEATURE_ROOT = '/w/specs/001-example-feature';

function site(id: string): DefinitionSite {
  return { id, fsPath: `${FEATURE_ROOT}/spec.md`, line: 0, kind: 'bullet' };
}

let revision = 0;
let editor: Editor | undefined;

function index(definitions: DefinitionSite[]): void {
  applySpeckitIndex({ revision: ++revision, featureRoot: FEATURE_ROOT, definitions });
}

/** What the export path does first: clone the live editor DOM. */
function exportClone(source: Editor): HTMLElement {
  return source.view.dom.cloneNode(true) as HTMLElement;
}

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

describe('stripSpeckitIdLinks removes the decoration from an export clone', () => {
  it('leaves no element carrying the identifier attribute', () => {
    index([site('FR-001'), site('T042')]);
    editor = createSpeckitEditor('The read path satisfies FR-001, delivered by T042.');
    expect(speckitLinkElements(editor)).toHaveLength(2);

    const clone = exportClone(editor);
    expect(stripSpeckitIdLinks(clone)).toBe(2);
    expect(clone.querySelectorAll('[data-speckit-id]')).toHaveLength(0);
  });

  it('keeps the identifier text, so the sentence still reads', () => {
    index([site('FR-001')]);
    editor = createSpeckitEditor('The read path satisfies FR-001 in full.');

    const clone = exportClone(editor);
    stripSpeckitIdLinks(clone);
    expect(clone.textContent).toContain('The read path satisfies FR-001 in full.');
  });

  it('leaves no anchor without a destination behind', () => {
    index([site('FR-001')]);
    editor = createSpeckitEditor('See FR-001.');

    const clone = exportClone(editor);
    stripSpeckitIdLinks(clone);
    const anchors = Array.from(clone.querySelectorAll('a'));
    expect(anchors.filter(anchor => !anchor.getAttribute('href'))).toHaveLength(0);
  });

  it('removes the cross-feature attribute along with its wrapper', () => {
    applySpeckitIndex({
      revision: ++revision,
      featureRoot: FEATURE_ROOT,
      definitions: [],
      qualified: [
        {
          feature: '024',
          featureRoot: '/w/specs/024-other-feature',
          definitions: [
            { id: 'FR-007', fsPath: '/w/specs/024-other-feature/spec.md', line: 0, kind: 'bullet' },
          ],
        },
      ],
    });
    editor = createSpeckitEditor('Compare feature 024 FR-007 with ours.');
    expect(speckitLinkElements(editor).length).toBeGreaterThan(0);

    const clone = exportClone(editor);
    stripSpeckitIdLinks(clone);
    expect(clone.querySelectorAll('[data-speckit-feature]')).toHaveLength(0);
  });

  it('leaves an author-written link untouched (FR-006, FR-020)', () => {
    index([site('FR-001')]);
    editor = createSpeckitEditor('See [the spec](https://example.com/spec) and FR-001.');

    const clone = exportClone(editor);
    stripSpeckitIdLinks(clone);
    const anchors = Array.from(clone.querySelectorAll('a'));
    expect(anchors).toHaveLength(1);
    expect(anchors[0].getAttribute('href')).toBe('https://example.com/spec');
  });

  it('is a no-op on a document with nothing decorated', () => {
    index([]);
    editor = createSpeckitEditor('Plain prose with no identifiers at all.');

    const clone = exportClone(editor);
    expect(stripSpeckitIdLinks(clone)).toBe(0);
    expect(clone.textContent).toContain('Plain prose with no identifiers at all.');
  });

  it('does not touch the live editor, which must keep its links (FR-024)', () => {
    index([site('FR-001')]);
    editor = createSpeckitEditor('See FR-001.');

    stripSpeckitIdLinks(exportClone(editor));
    expect(speckitLinkElements(editor)).toHaveLength(1);
  });
});
