/** @jest-environment jsdom */

/**
 * Cross-feature references in the view layer (FR-017, FR-018).
 *
 * The pure binding rules are pinned in `shared/speckitIds/qualifiers.test.ts`.
 * What is asserted here is the wiring the manual check would otherwise be the
 * only witness to: that a qualified reference decorates against the SIBLING's
 * definitions, that it carries the feature number to the click handler, and
 * that an unqualified reference cannot reach those definitions even though they
 * are sitting in the same webview's memory.
 */

import type { Editor } from '@tiptap/core';
import { createSpeckitEditor, speckitLinkElements } from './helpers/speckitEditorHarness';
import {
  applySpeckitIndex,
  lookupSpeckitDefinition,
  resetSpeckitIndex,
} from '../../webview/extensions/speckitIdLinks';
import { setDocumentPath, resetDocumentPath } from '../../webview/utils/documentPath';
import type { DefinitionSite } from '../../features/speckitIndex/extract';

const FEATURE_ROOT = '/w/specs/001-example-feature';
const SIBLING_ROOT = '/w/specs/008-github-app-credentials';

const site = (id: string, root: string, file = 'spec.md'): DefinitionSite => ({
  id,
  fsPath: `${root}/${file}`,
  line: 0,
  kind: 'bullet',
});

let revision = 0;
let editor: Editor | undefined;

function index(
  definitions: DefinitionSite[],
  qualified: Array<{ feature: string; featureRoot: string; definitions: DefinitionSite[] }> = []
): void {
  applySpeckitIndex({ revision: ++revision, featureRoot: FEATURE_ROOT, definitions, qualified });
}

/** The local feature and feature 008, as the host would push them together. */
function indexBothFeatures(): void {
  index(
    [site('FR-001', FEATURE_ROOT)],
    [
      {
        feature: '008',
        featureRoot: SIBLING_ROOT,
        definitions: [site('FR-P07', SIBLING_ROOT), site('FR-001', SIBLING_ROOT)],
      },
    ]
  );
}

beforeEach(() => {
  resetSpeckitIndex();
  resetDocumentPath();
  setDocumentPath('specs/001-example-feature/tasks.md');
});

afterEach(() => {
  editor?.destroy();
  editor = undefined;
  resetSpeckitIndex();
  resetDocumentPath();
});

describe('a qualified reference resolves into the named feature (FR-017)', () => {
  it('decorates it and records the feature number for the click handler', () => {
    indexBothFeatures();
    editor = createSpeckitEditor('Blocked on 008 FR-P07 landing first.');

    const elements = speckitLinkElements(editor);
    expect(elements).toHaveLength(1);
    expect(elements[0].getAttribute('data-speckit-id')).toBe('FR-P07');
    expect(elements[0].getAttribute('data-speckit-feature')).toBe('008');
  });

  it('sends the click to the sibling file, not to the local one of the same name', () => {
    indexBothFeatures();
    expect(lookupSpeckitDefinition('FR-001', '008')?.fsPath).toBe(`${SIBLING_ROOT}/spec.md`);
    expect(lookupSpeckitDefinition('FR-001')?.fsPath).toBe(`${FEATURE_ROOT}/spec.md`);
  });

  it('leaves a qualified reference the sibling does not define as plain prose', () => {
    indexBothFeatures();
    editor = createSpeckitEditor('Blocked on 008 T042 landing first.');
    expect(speckitLinkElements(editor)).toHaveLength(0);
  });
});

describe('an unqualified reference never falls through (FR-018)', () => {
  it('does not link an identifier only the sibling defines', () => {
    indexBothFeatures();
    editor = createSpeckitEditor('Blocked on FR-P07 landing first.');
    expect(speckitLinkElements(editor)).toHaveLength(0);
  });

  it('cannot bind a feature the host never indexed', () => {
    index([site('FR-001', FEATURE_ROOT)]);
    editor = createSpeckitEditor('Blocked on 008 FR-001 landing first.');

    // `008` binds nothing, so the token is unqualified — and an unqualified
    // token resolves locally, which is exactly where FR-018 wants it.
    const elements = speckitLinkElements(editor);
    expect(elements).toHaveLength(1);
    expect(elements[0].hasAttribute('data-speckit-feature')).toBe(false);
  });

  it('marks nothing cross-feature when the push carries no qualified bucket', () => {
    applySpeckitIndex({
      revision: ++revision,
      featureRoot: FEATURE_ROOT,
      definitions: [site('FR-001', FEATURE_ROOT)],
    });
    editor = createSpeckitEditor('See 008 FR-001 and FR-001.');
    expect(
      speckitLinkElements(editor).map(element => element.hasAttribute('data-speckit-feature'))
    ).toEqual([false, false]);
  });
});
