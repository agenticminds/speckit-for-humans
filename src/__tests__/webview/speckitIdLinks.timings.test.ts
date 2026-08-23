/** @jest-environment jsdom */

/**
 * The decoration pass records its stages separately (T065, SC-009).
 *
 * Two stages live in the webview: recognizing identifiers in a run of text, and
 * turning the recognized tokens into a decoration set. They are recorded apart
 * so a regression in the grammar is not mistaken for a regression in the
 * plugin. No threshold is asserted; SC-009 sets none.
 */

import type { Editor } from '@tiptap/core';
import { createSpeckitEditor } from './helpers/speckitEditorHarness';
import {
  applySpeckitIndex,
  resetSpeckitIndex,
  refreshSpeckitIdLinks,
} from '../../webview/extensions/speckitIdLinks';
import { setDocumentPath, resetDocumentPath } from '../../webview/utils/documentPath';
import { webviewStageTimings } from '../../shared/perf/stageTimings';
import type { DefinitionSite } from '../../features/speckitIndex/extract';

const FEATURE_ROOT = '/w/specs/001-example-feature';

function site(id: string): DefinitionSite {
  return { id, fsPath: `${FEATURE_ROOT}/spec.md`, line: 0, kind: 'bullet' };
}

let revision = 0;
let editor: Editor | undefined;

beforeEach(() => {
  resetSpeckitIndex();
  resetDocumentPath();
  setDocumentPath('specs/001-example-feature/plan.md');
  webviewStageTimings.reset();
});

afterEach(() => {
  editor?.destroy();
  editor = undefined;
  resetSpeckitIndex();
  resetDocumentPath();
  webviewStageTimings.reset();
});

it('records tokenize and decorate as two separate stages', () => {
  applySpeckitIndex({
    revision: ++revision,
    featureRoot: FEATURE_ROOT,
    definitions: [site('FR-001')],
  });
  editor = createSpeckitEditor('The read path satisfies FR-001 in full.');

  const snapshot = webviewStageTimings.snapshot();
  expect(snapshot.tokenize?.calls).toBeGreaterThan(0);
  expect(snapshot.decorate?.calls).toBeGreaterThan(0);
});

it('records a decoration pass per repaint, so a repeated rebuild is visible', () => {
  applySpeckitIndex({
    revision: ++revision,
    featureRoot: FEATURE_ROOT,
    definitions: [site('FR-001')],
  });
  editor = createSpeckitEditor('See FR-001.');

  const before = webviewStageTimings.snapshot().decorate?.calls ?? 0;
  refreshSpeckitIdLinks(editor);
  expect(webviewStageTimings.snapshot().decorate?.calls ?? 0).toBeGreaterThan(before);
});

it('records nothing when there is no index, since no pass runs', () => {
  editor = createSpeckitEditor('See FR-001.');
  expect(webviewStageTimings.snapshot()).toEqual({});
});
