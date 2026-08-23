/** @jest-environment jsdom */

/**
 * The reveal fallback (C-msg-4g).
 *
 * When a reveal reaches a document whose parsed form does not contain the
 * definition, the navigation must not simply evaporate. It falls back to the
 * existing line-based open-at-location handler, which lands in VS Code's plain
 * text editor — the one place a raw line number is correct, because nothing has
 * rewritten the content on the way in.
 *
 * The line is taken from the webview's OWN index and never from the reveal
 * message, which carries no line number by contract (C-msg-4a).
 */

import {
  applySpeckitIndex,
  resetSpeckitIndex,
  speckitRevealFallback,
} from '../../webview/extensions/speckitIdLinks';
import type { DefinitionSite } from '../../features/speckitIndex/extract';

const FEATURE_ROOT = '/w/specs/001-example-feature';

let revision = 0;

function index(definitions: DefinitionSite[]): void {
  applySpeckitIndex({ revision: ++revision, featureRoot: FEATURE_ROOT, definitions });
}

beforeEach(() => resetSpeckitIndex());
afterEach(() => resetSpeckitIndex());

it('opens the recorded artifact at the recorded line', () => {
  index([{ id: 'FR-001', fsPath: `${FEATURE_ROOT}/spec.md`, line: 41, kind: 'bullet' }]);

  expect(speckitRevealFallback('FR-001')).toEqual({
    type: 'openFileAtLocation',
    fsPath: `${FEATURE_ROOT}/spec.md`,
    // The index records a zero-based line; the handler expects one-based.
    line: 42,
    openToSide: false,
  });
});

it('converts the first line of a file correctly rather than clamping it', () => {
  index([{ id: 'FR-001', fsPath: `${FEATURE_ROOT}/spec.md`, line: 0, kind: 'bullet' }]);
  expect(speckitRevealFallback('FR-001')?.line).toBe(1);
});

it('degrades silently for an identifier the index does not hold', () => {
  index([{ id: 'FR-001', fsPath: `${FEATURE_ROOT}/spec.md`, line: 0, kind: 'bullet' }]);
  expect(speckitRevealFallback('FR-999')).toBeNull();
});

it('degrades silently when no index has arrived at all', () => {
  expect(speckitRevealFallback('FR-001')).toBeNull();
});

it('degrades silently for an empty identifier', () => {
  index([{ id: 'FR-001', fsPath: `${FEATURE_ROOT}/spec.md`, line: 0, kind: 'bullet' }]);
  expect(speckitRevealFallback('')).toBeNull();
});

it('degrades silently for a definition with no recorded path', () => {
  index([{ id: 'FR-001', fsPath: '', line: 3, kind: 'bullet' }]);
  expect(speckitRevealFallback('FR-001')).toBeNull();
});

it('never asks for a split, so the fallback cannot rearrange the layout', () => {
  index([{ id: 'T042', fsPath: `${FEATURE_ROOT}/tasks.md`, line: 7, kind: 'checkboxBare' }]);
  expect(speckitRevealFallback('T042')?.openToSide).toBe(false);
});
