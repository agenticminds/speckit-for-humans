/**
 * Feature-folder discovery (FR-019).
 *
 * A feature folder is identified by its NUMBERED NAME and by nothing else.
 * Three of the 45 real feature folders in the survey have no `spec.md` at all,
 * and one of those still defines an identifier, so keying discovery on the
 * presence of a specification file mis-scopes them. Keying it on
 * `.specify/feature.json` is worse still: that file records one active feature,
 * so it would mis-resolve 44 of 45.
 *
 * Discovery is pure path arithmetic. It touches no file system, which is why it
 * is testable without the VS Code mock at all.
 */

import {
  discoverFeatureScope,
  isWithinFeatureScope,
} from '../../../features/speckitIndex/discovery';

function uri(fsPath: string, scheme = 'file') {
  return { fsPath, scheme };
}

describe('a folder is found by its numbered name (FR-019)', () => {
  it('resolves a document sitting directly in a numbered folder', () => {
    const scope = discoverFeatureScope(uri('/w/specs/001-example-feature/plan.md'));
    expect(scope.featureRoot).toBe('/w/specs/001-example-feature');
    expect(scope.specsRoot).toBe('/w/specs');
  });

  it('recurses out of a subfolder, because contracts live one level down', () => {
    const scope = discoverFeatureScope(
      uri('/w/specs/001-example-feature/contracts/example.contract.md')
    );
    expect(scope.featureRoot).toBe('/w/specs/001-example-feature');
  });

  it('takes the NEAREST numbered ancestor when folders nest', () => {
    const scope = discoverFeatureScope(uri('/w/specs/001-outer/002-inner/tasks.md'));
    expect(scope.featureRoot).toBe('/w/specs/001-outer/002-inner');
    expect(scope.specsRoot).toBe('/w/specs/001-outer');
  });

  it('finds a folder that contains no specification file', () => {
    // Nothing here reads the disk, which is exactly the point: presence of
    // spec.md is not, and must not become, part of the test.
    const scope = discoverFeatureScope(uri('/w/specs/003-no-spec-here/tasks.md'));
    expect(scope.featureRoot).toBe('/w/specs/003-no-spec-here');
  });

  it('requires exactly three digits followed by a hyphen', () => {
    expect(discoverFeatureScope(uri('/w/specs/01-two-digits/plan.md')).featureRoot).toBeNull();
    expect(discoverFeatureScope(uri('/w/specs/0001-four-digits/plan.md')).featureRoot).toBeNull();
    expect(discoverFeatureScope(uri('/w/specs/001nohyphen/plan.md')).featureRoot).toBeNull();
  });
});

describe('a document outside any numbered folder yields no scope (FR-019)', () => {
  it('returns nulls for a document in an ordinary folder', () => {
    const scope = discoverFeatureScope(uri('/w/docs/README.md'));
    expect(scope).toEqual({ featureRoot: null, specsRoot: null, briefsDir: null });
  });

  it('returns nulls for a non-file scheme', () => {
    const scope = discoverFeatureScope(uri('/w/specs/001-example-feature/plan.md', 'untitled'));
    expect(scope).toEqual({ featureRoot: null, specsRoot: null, briefsDir: null });
  });

  it('returns nulls for a missing uri', () => {
    const none = { featureRoot: null, specsRoot: null, briefsDir: null };
    expect(discoverFeatureScope(null)).toEqual(none);
    expect(discoverFeatureScope(undefined)).toEqual(none);
  });
});

describe('containment (C-msg-3e)', () => {
  const scope = discoverFeatureScope(uri('/w/specs/001-example-feature/plan.md'));

  it('admits a path inside the feature root', () => {
    expect(
      isWithinFeatureScope('/w/specs/001-example-feature/contracts/example.contract.md', scope)
    ).toBe(true);
  });

  it('admits a sibling feature under the specs root, which qualified references need', () => {
    expect(isWithinFeatureScope('/w/specs/002-second-feature/spec.md', scope)).toBe(true);
  });

  it('rejects a path outside both roots', () => {
    expect(isWithinFeatureScope('/w/other/spec.md', scope)).toBe(false);
    expect(isWithinFeatureScope('/etc/passwd', scope)).toBe(false);
  });

  it('rejects a traversal attempt that escapes the specs root', () => {
    expect(isWithinFeatureScope('/w/specs/001-example-feature/../../../etc/passwd', scope)).toBe(
      false
    );
  });

  it('rejects everything when there is no scope at all', () => {
    const none = discoverFeatureScope(uri('/w/docs/README.md'));
    expect(isWithinFeatureScope('/w/docs/README.md', none)).toBe(false);
  });

  it('does not admit a sibling directory whose name merely starts with the root', () => {
    expect(isWithinFeatureScope('/w/specs-private/leak.md', scope)).toBe(false);
  });
});

/**
 * The shared briefs folder (FR-016).
 *
 * `BR-`, `AD-` and `OQ-` originate in `briefs/` and are then cited from inside
 * numbered feature folders — 90 and 42 such references respectively in the
 * survey. A tool scoped to the numbered folder alone never finds their definitions, so the
 * scope has to name the sibling folder explicitly.
 *
 * Presence is deliberately NOT checked here. Discovery stays pure path
 * arithmetic; a briefs folder that does not exist simply contributes no files
 * when the index tries to list it.
 */
describe('the shared briefs folder sits beside the feature folders (FR-016)', () => {
  it('names it as a sibling of the feature root, under the specs root', () => {
    const scope = discoverFeatureScope(uri('/w/specs/001-example-feature/plan.md'));
    expect(scope.briefsDir).toBe('/w/specs/briefs');
  });

  it('names it for a document nested in a subfolder too', () => {
    const scope = discoverFeatureScope(
      uri('/w/specs/001-example-feature/contracts/example.contract.md')
    );
    expect(scope.briefsDir).toBe('/w/specs/briefs');
  });

  it('follows the NEAREST feature root when folders nest', () => {
    const scope = discoverFeatureScope(uri('/w/specs/001-outer/002-inner/tasks.md'));
    expect(scope.briefsDir).toBe('/w/specs/001-outer/briefs');
  });

  it('has no briefs folder when there is no feature scope at all', () => {
    expect(discoverFeatureScope(uri('/w/docs/README.md')).briefsDir).toBeNull();
    expect(discoverFeatureScope(null).briefsDir).toBeNull();
  });

  it('admits a file inside the briefs folder for reading (C-msg-3e)', () => {
    const scope = discoverFeatureScope(uri('/w/specs/001-example-feature/plan.md'));
    expect(isWithinFeatureScope('/w/specs/briefs/multibase-ingress.md', scope)).toBe(true);
  });
});
