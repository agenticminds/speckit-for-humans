/** @jest-environment jsdom */

/**
 * Self-reference suppression (FR-014).
 *
 * The occurrence of an identifier on its own defining line stays plain text.
 * Linking a definition to itself is a dead gesture that looks like a bug.
 *
 * The decision is made from BLOCK SHAPE in the webview's own document, never
 * from a raw line number. Raw lines are wrong in roughly 6.5% of real files,
 * because content is rewritten twice on its way into the webview: the blank-line
 * policy collapses runs and the frontmatter wrapper inserts two lines. Deciding
 * locally is what removed the last reason to map raw lines to editor positions.
 */

import type { Editor } from '@tiptap/core';
import { createSpeckitEditor, speckitLinkedIds } from './helpers/speckitEditorHarness';
import { applySpeckitIndex, resetSpeckitIndex } from '../../webview/extensions/speckitIdLinks';
import { setDocumentPath, resetDocumentPath } from '../../webview/utils/documentPath';
import type { DefinitionSite } from '../../features/speckitIndex/extract';

const FEATURE_ROOT = '/w/specs/001-example-feature';

let revision = 0;

function index(definitions: DefinitionSite[]): void {
  applySpeckitIndex({ revision: ++revision, featureRoot: FEATURE_ROOT, definitions });
}

function here(id: string, kind: DefinitionSite['kind'], headingText?: string): DefinitionSite {
  // Defined in the document the editor is showing.
  return { id, fsPath: `${FEATURE_ROOT}/spec.md`, line: 0, kind, headingText };
}

function elsewhere(id: string, kind: DefinitionSite['kind'] = 'bullet'): DefinitionSite {
  return { id, fsPath: `${FEATURE_ROOT}/tasks.md`, line: 0, kind };
}

let editor: Editor | undefined;

beforeEach(() => {
  resetSpeckitIndex();
  resetDocumentPath();
  // The editor is showing spec.md itself.
  setDocumentPath('specs/001-example-feature/spec.md');
});

afterEach(() => {
  editor?.destroy();
  editor = undefined;
  resetSpeckitIndex();
  resetDocumentPath();
});

describe('the defining occurrence stays plain (FR-014)', () => {
  it('suppresses a bolded bullet definition', () => {
    index([here('FR-001', 'bullet')]);
    editor = createSpeckitEditor('- **FR-001**: The system MUST render a stored document.');
    expect(speckitLinkedIds(editor)).toEqual([]);
  });

  it('suppresses a bare checkbox definition', () => {
    index([here('T027', 'checkboxBare')]);
    editor = createSpeckitEditor('- [ ] T027 [P] [US1] Render a stored document');
    expect(speckitLinkedIds(editor)).toEqual([]);
  });

  it('suppresses a bolded checkbox definition', () => {
    index([here('US8-1', 'checkboxBold')]);
    editor = createSpeckitEditor('- [ ] **US8-1**: Storage is created on first write.');
    expect(speckitLinkedIds(editor)).toEqual([]);
  });

  it('suppresses a heading definition', () => {
    index([here('R-001', 'heading')]);
    editor = createSpeckitEditor('## R-001: How is a folder handle obtained');
    expect(speckitLinkedIds(editor)).toEqual([]);
  });

  it('suppresses a table-cell definition', () => {
    index([here('R-029', 'tableRow')]);
    editor = createSpeckitEditor(
      ['| ID | Question |', '|---|---|', '| R-029 | Does a handle survive a restart |'].join('\n')
    );
    expect(speckitLinkedIds(editor)).toEqual([]);
  });

  it('suppresses a bolded identifier opening a paragraph', () => {
    index([here('AD-5', 'paragraphBold')]);
    editor = createSpeckitEditor('**AD-5** When a handle is released it is never re-issued.');
    expect(speckitLinkedIds(editor)).toEqual([]);
  });
});

describe('a reference elsewhere in the same document still links (FR-014)', () => {
  it('links the prose occurrence while suppressing the definition', () => {
    index([here('FR-001', 'bullet')]);
    editor = createSpeckitEditor(
      [
        '- **FR-001**: The system MUST render a stored document.',
        '',
        'See FR-001 for detail.',
      ].join('\n')
    );
    // Exactly one link: the prose reference, not the definition.
    expect(speckitLinkedIds(editor)).toEqual(['FR-001']);
  });

  it('links a mid-block occurrence in the defining line itself', () => {
    index([here('FR-001', 'bullet'), here('FR-002', 'bullet')]);
    editor = createSpeckitEditor('- **FR-001**: This one refines FR-002.');
    expect(speckitLinkedIds(editor)).toEqual(['FR-002']);
  });

  it('links a leading occurrence whose definition lives in another artifact', () => {
    // Same block shape, but the definition is not here, so it is a reference and
    // must link. Suppressing on shape alone would break this.
    index([elsewhere('T042', 'checkboxBare')]);
    editor = createSpeckitEditor('- [ ] T042 is tracked in the task list');
    expect(speckitLinkedIds(editor)).toEqual(['T042']);
  });

  it('links a leading occurrence whose block shape does not match the definition', () => {
    // spec.md defines FR-001 as a bullet. A paragraph in the same file that
    // happens to open with the identifier is prose, not the definition.
    index([here('FR-001', 'bullet')]);
    editor = createSpeckitEditor('FR-001 is discussed at length below.');
    expect(speckitLinkedIds(editor)).toEqual(['FR-001']);
  });
});

describe('the derived user-story heading has nothing to suppress (FR-012)', () => {
  it('leaves the heading alone and links the tagged reference', () => {
    // `US1` appears nowhere in the heading text, so there is no token there to
    // suppress; the tag in the body is a genuine reference.
    index([
      here('US1', 'userStoryHeading', 'User Story 1 - Open a stored document (Priority: P1)'),
    ]);
    editor = createSpeckitEditor(
      ['### User Story 1 - Open a stored document (Priority: P1)', '', 'Tagged as [US1].'].join(
        '\n'
      )
    );
    expect(speckitLinkedIds(editor)).toEqual(['US1']);
  });
});
