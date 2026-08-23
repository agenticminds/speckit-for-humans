/** @jest-environment jsdom */

/**
 * Zero bytes added, at either end (FR-013, FR-024, SC-005). **Enforced gate.**
 *
 * The whole feature rests on one structural claim: the link presentation is a
 * ProseMirror DECORATION, which lives in the view, and never a mark, which
 * would live in `state.doc` and be serialized straight into the file.
 *
 * The proof is a differential one. Two editors are built from the same source,
 * one with the extension registered and one without, and both the serialized
 * markdown and the document JSON must agree exactly. Deep-equal JSON is the
 * assertion that actually matters: string equality could in principle survive a
 * mark the serializer happens to drop, but a mark cannot hide in `getJSON()`.
 *
 * This uses the repo's real-TipTap jsdom harness, not mocks, because a mocked
 * serializer would prove nothing about what reaches disk.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import type { Editor } from '@tiptap/core';
import { createSpeckitEditor, speckitLinkedIds } from './helpers/speckitEditorHarness';
import { getEditorMarkdownForSync } from '../../webview/utils/markdownSerialization';
import { applySpeckitIndex, resetSpeckitIndex } from '../../webview/extensions/speckitIdLinks';
import { setDocumentPath, resetDocumentPath } from '../../webview/utils/documentPath';
import { extractDefinitions, type DefinitionSite } from '../../features/speckitIndex/extract';

const FIXTURES = join(__dirname, '../fixtures/speckit');
const FEATURE_ROOT = join(FIXTURES, 'specs/001-example-feature');

function markdownFiles(dir: string): string[] {
  return readdirSync(dir)
    .flatMap(name => {
      const full = join(dir, name);
      return statSync(full).isDirectory()
        ? markdownFiles(full)
        : full.endsWith('.md')
          ? [full]
          : [];
    })
    .sort();
}

/** Every definition the fixture feature folder declares, so links actually resolve. */
function fixtureIndex(): DefinitionSite[] {
  return markdownFiles(join(FIXTURES, 'specs')).flatMap(file =>
    extractDefinitions(readFileSync(file, 'utf8'), file)
  );
}

let editors: Editor[] = [];

function build(markdown: string, withExtension: boolean): Editor {
  const editor = createSpeckitEditor(markdown, { withExtension });
  editors.push(editor);
  return editor;
}

beforeEach(() => {
  resetSpeckitIndex();
  resetDocumentPath();
  setDocumentPath(join(FEATURE_ROOT, 'plan.md'));
  applySpeckitIndex({ revision: 1, featureRoot: FEATURE_ROOT, definitions: fixtureIndex() });
});

afterEach(() => {
  editors.forEach(editor => editor.destroy());
  editors = [];
  resetSpeckitIndex();
  resetDocumentPath();
});

const CASES: Array<[string, string]> = [
  ['plan', 'specs/001-example-feature/plan.md'],
  ['spec', 'specs/001-example-feature/spec.md'],
  ['tasks', 'specs/001-example-feature/tasks.md'],
  ['research', 'specs/001-example-feature/research.md'],
  ['contract', 'specs/001-example-feature/contracts/example.contract.md'],
  ['brief', 'specs/briefs/example-brief.md'],
];

describe('the extension adds no bytes to the document (SC-005, FR-024)', () => {
  it.each(CASES)('%s: serialized markdown is string-identical', (_name, relativePath) => {
    const source = readFileSync(join(FIXTURES, relativePath), 'utf8');
    const withExt = getEditorMarkdownForSync(build(source, true));
    const withoutExt = getEditorMarkdownForSync(build(source, false));
    expect(withExt).toBe(withoutExt);
  });

  it.each(CASES)('%s: document JSON is deep-equal', (_name, relativePath) => {
    const source = readFileSync(join(FIXTURES, relativePath), 'utf8');
    // The load-bearing assertion. A mark would appear here; a decoration cannot.
    expect(build(source, true).getJSON()).toEqual(build(source, false).getJSON());
  });
});

describe('the proof is not vacuous', () => {
  it('the extension really was doing something on the documents compared above', () => {
    const source = readFileSync(join(FIXTURES, 'specs/001-example-feature/plan.md'), 'utf8');
    const editor = build(source, true);
    // If this were zero, the equality assertions above would prove nothing at
    // all — they would be comparing two editors that both did nothing.
    expect(speckitLinkedIds(editor).length).toBeGreaterThan(20);
  });

  it('and the editor without the extension produced no ID links', () => {
    const source = readFileSync(join(FIXTURES, 'specs/001-example-feature/plan.md'), 'utf8');
    expect(speckitLinkedIds(build(source, false))).toEqual([]);
  });
});

describe('the target side is unaltered too (FR-024)', () => {
  it('a document that only DEFINES identifiers round-trips unchanged', () => {
    // The end people forget. Navigating to a definition must not add anchors to
    // the artifact that holds it.
    setDocumentPath(join(FEATURE_ROOT, 'spec.md'));
    const source = readFileSync(join(FIXTURES, 'specs/001-example-feature/spec.md'), 'utf8');
    const withExt = build(source, true);
    const withoutExt = build(source, false);
    expect(getEditorMarkdownForSync(withExt)).toBe(getEditorMarkdownForSync(withoutExt));
    expect(withExt.getJSON()).toEqual(withoutExt.getJSON());
  });
});
