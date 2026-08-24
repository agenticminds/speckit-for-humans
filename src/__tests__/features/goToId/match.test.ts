/**
 * Turning recognised identifiers into destinations.
 *
 * Two rules carry the behaviour: the match is case-insensitive, because the
 * text came from a clipboard rather than from a parsed document; and the same
 * place is never offered twice, because the candidate chain deliberately
 * overlaps.
 */

import type { DefinitionSite } from '../../../features/speckitIndex/extract';
import {
  dedupeDefinitions,
  matchDefinitions,
  type LocatedDefinition,
} from '../../../features/goToId/match';

function at(id: string, fsPath: string, line: number, featureRoot = '/w/specs/001-a') {
  const site: DefinitionSite = { id, fsPath, line, kind: 'bullet' };
  return { site, featureRoot } satisfies LocatedDefinition;
}

describe('identifiers are matched to definitions', () => {
  const index = [
    at('T042', '/w/specs/001-a/tasks.md', 10),
    at('FR-003', '/w/specs/001-a/spec.md', 4),
  ];

  it('finds the one definition an identifier names', () => {
    expect(matchDefinitions(index, ['T042'])).toEqual([index[0]]);
  });

  it('returns matches in the order the identifiers were written', () => {
    expect(matchDefinitions(index, ['FR-003', 'T042'])).toEqual([index[1], index[0]]);
  });

  it('ignores case, because a clipboard is not a parsed document', () => {
    expect(matchDefinitions(index, ['t042'])).toEqual([index[0]]);
  });

  it('returns nothing for an identifier no artifact defines', () => {
    expect(matchDefinitions(index, ['T999'])).toEqual([]);
  });

  it('returns nothing when there are no identifiers to look for', () => {
    expect(matchDefinitions(index, [])).toEqual([]);
  });

  it('returns every definition when one identifier has several', () => {
    // Legitimate: the same id declared in two artifacts, or in two features
    // once the search has widened. Choosing between them is the picker's job.
    const twice = [
      at('T042', '/w/specs/001-a/tasks.md', 10),
      at('T042', '/w/specs/002-b/tasks.md', 3, '/w/specs/002-b'),
    ];
    expect(matchDefinitions(twice, ['T042'])).toHaveLength(2);
  });
});

describe('the same place is never offered twice', () => {
  it('collapses an entry reached through two feature roots', () => {
    const viaTwoRoots = [
      at('T042', '/w/specs/001-a/tasks.md', 10, '/w/specs/001-a'),
      at('T042', '/w/specs/001-a/tasks.md', 10, '/w/specs/002-b'),
    ];
    expect(dedupeDefinitions(viaTwoRoots)).toHaveLength(1);
  });

  it('keeps two definitions of one id that sit on different lines', () => {
    const distinct = [
      at('T042', '/w/specs/001-a/tasks.md', 10),
      at('T042', '/w/specs/001-a/tasks.md', 20),
    ];
    expect(dedupeDefinitions(distinct)).toHaveLength(2);
  });

  it('keeps the first occurrence, so priority order survives', () => {
    const duplicated = [
      at('T042', '/w/specs/001-a/tasks.md', 10, '/w/specs/001-a'),
      at('T042', '/w/specs/001-a/tasks.md', 10, '/w/specs/999-z'),
    ];
    expect(dedupeDefinitions(duplicated)[0].featureRoot).toBe('/w/specs/001-a');
  });

  it('passes an already-unique list through unchanged', () => {
    const unique = [at('T042', '/w/specs/001-a/tasks.md', 10)];
    expect(dedupeDefinitions(unique)).toEqual(unique);
  });
});
