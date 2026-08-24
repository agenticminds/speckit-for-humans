/**
 * Where the identifier comes from, and what counts as one.
 *
 * The precedence rule is the whole user-facing contract of the command: if an
 * identifier is highlighted, that is what you meant; otherwise fall back to the
 * clipboard, which is the only channel out of a terminal or an assistant panel.
 *
 * Pure functions, so no VS Code mock is involved.
 */

import { idsFromQuery, pickQueryText } from '../../../features/goToId/query';

describe('a selection beats the clipboard', () => {
  it('uses the selection when there is one', () => {
    expect(pickQueryText('T042', 'FR-003')).toBe('T042');
  });

  it('falls back to the clipboard when nothing is selected', () => {
    expect(pickQueryText('', 'FR-003')).toBe('FR-003');
  });

  it('treats a whitespace-only selection as no selection', () => {
    // Dragging past the end of a line is common, and must not shadow a
    // perfectly good clipboard.
    expect(pickQueryText('   \n\t ', 'FR-003')).toBe('FR-003');
  });

  it('trims both sources, because a double-click usually takes the space too', () => {
    expect(pickQueryText('  T042 ', '')).toBe('T042');
    expect(pickQueryText(undefined, '\nFR-003\n')).toBe('FR-003');
  });

  it('reports nothing when neither source offers anything', () => {
    expect(pickQueryText(null, undefined)).toBe('');
  });
});

describe('identifiers are read with the same grammar the editor links with', () => {
  it('finds a bare identifier', () => {
    expect(idsFromQuery('T042')).toEqual(['T042']);
  });

  it('finds an identifier inside a sentence', () => {
    // The realistic clipboard: a line copied out of an assistant's reply.
    expect(idsFromQuery('Next up is T042, then we are done.')).toEqual(['T042']);
  });

  it('finds every identifier in a multi-id line, in written order', () => {
    expect(idsFromQuery('FR-003 depends on T042')).toEqual(['FR-003', 'T042']);
  });

  it('expands a compressed reference the same way a rendered link would', () => {
    // The grammar reads this as the two identifiers that were written, not as
    // an inclusive range. Whether that is the right reading is settled in the
    // grammar's own tests; what matters here is that this command cannot
    // disagree with what the editor would have linked.
    expect(idsFromQuery('T042-T044')).toEqual(['T042', 'T044']);
  });

  it('reports each destination once, however often it was written', () => {
    expect(idsFromQuery('T042 and T042 again')).toEqual(['T042']);
  });

  it('finds nothing in text that holds no identifier', () => {
    expect(idsFromQuery('just some prose')).toEqual([]);
  });

  it('finds nothing in empty text', () => {
    expect(idsFromQuery('')).toEqual([]);
  });
});
