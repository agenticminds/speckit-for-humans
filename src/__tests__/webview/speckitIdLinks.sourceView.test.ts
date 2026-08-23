/** @jest-environment jsdom */

/**
 * The source view is unaffected (FR-023).
 *
 * "Open source view" hands VS Code the document's own URI, so what it shows is
 * whatever the editor would sync to the file. The runnable form of FR-023 is
 * therefore: for a document whose VISUAL view carries resolved links, the text
 * the editor would store is exactly the text it was given, with no link markup
 * of any kind in it.
 *
 * This is deliberately a different assertion from the byte-identity test next
 * door. That one compares two editors against each other; this one compares the
 * decorated editor against the ORIGINAL SOURCE, which is what a person actually
 * sees when they flip to markdown.
 */

import type { Editor } from '@tiptap/core';
import { createSpeckitEditor, speckitLinkedIds } from './helpers/speckitEditorHarness';
import { getEditorMarkdownForSync } from '../../webview/utils/markdownSerialization';
import { applySpeckitIndex, resetSpeckitIndex } from '../../webview/extensions/speckitIdLinks';
import { setDocumentPath, resetDocumentPath } from '../../webview/utils/documentPath';
import type { DefinitionSite } from '../../features/speckitIndex/extract';

const FEATURE_ROOT = '/w/specs/001-example-feature';

function site(id: string, file = 'spec.md'): DefinitionSite {
  return { id, fsPath: `${FEATURE_ROOT}/${file}`, line: 0, kind: 'bullet' };
}

const SOURCE = [
  '# Plan',
  '',
  'The read path satisfies FR-001 and FR-002.',
  '',
  '- [ ] T042 restores the scroll position',
  '',
  'Nothing here is written as a link.',
  '',
].join('\n');

let editor: Editor | undefined;

beforeEach(() => {
  resetSpeckitIndex();
  resetDocumentPath();
  setDocumentPath('specs/001-example-feature/plan.md');
  applySpeckitIndex({
    revision: 1,
    featureRoot: FEATURE_ROOT,
    definitions: [site('FR-001'), site('FR-002'), site('T042', 'tasks.md')],
  });
  editor = createSpeckitEditor(SOURCE);
});

afterEach(() => {
  editor?.destroy();
  editor = undefined;
  resetSpeckitIndex();
  resetDocumentPath();
});

describe('the plain markdown view shows exactly the stored text (FR-023)', () => {
  it('the visual view really is carrying resolved links', () => {
    // Precondition. Without it the assertions below are vacuous.
    expect(speckitLinkedIds(editor as Editor)).toEqual(['FR-001', 'FR-002', 'T042']);
  });

  it('round-trips the source unchanged', () => {
    expect(getEditorMarkdownForSync(editor as Editor)).toBe(SOURCE.trimEnd());
  });

  it('contains no markdown link syntax at all', () => {
    const markdown = getEditorMarkdownForSync(editor as Editor);
    expect(markdown).not.toMatch(/\]\(/);
    expect(markdown).not.toMatch(/<a\b/);
  });

  it('contains none of the decoration attributes or classes', () => {
    const markdown = getEditorMarkdownForSync(editor as Editor);
    expect(markdown).not.toContain('data-speckit-id');
    expect(markdown).not.toContain('markdown-link');
  });

  it('keeps each identifier as bare text on its original line', () => {
    const lines = getEditorMarkdownForSync(editor as Editor).split('\n');
    expect(lines).toContain('The read path satisfies FR-001 and FR-002.');
    expect(lines).toContain('- [ ] T042 restores the scroll position');
  });
});
