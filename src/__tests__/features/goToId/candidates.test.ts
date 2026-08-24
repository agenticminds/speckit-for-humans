/**
 * The order the command widens its search in.
 *
 * The chain exists because this command is invoked exactly when the editor's
 * own scoping does not apply - no markdown document is focused, so there is no
 * document whose feature folder could scope anything. Each step is a weaker
 * guess than the one before, so the order is the behaviour.
 *
 * Pure path arithmetic, like `discoverFeatureScope`, so no file system and no
 * VS Code mock.
 */

import { isFeatureDirName, orderScopeCandidates } from '../../../features/goToId/candidates';
import { discoverFeatureScope } from '../../../features/speckitIndex/discovery';

describe('the chain runs most specific first', () => {
  it('puts all four sources in priority order', () => {
    const ordered = orderScopeCandidates({
      activeFeatureRoot: '/w/specs/001-a',
      lastFeatureRoot: '/w/specs/002-b',
      featureJsonRoot: '/w/specs/003-c',
      allFeatureRoots: ['/w/specs/004-d'],
    });
    expect(ordered.map(c => c.source)).toEqual([
      'activeDocument',
      'lastDocument',
      'featureJson',
      'allFeatures',
    ]);
  });

  it('skips a source that has nothing to offer', () => {
    const ordered = orderScopeCandidates({
      activeFeatureRoot: null,
      lastFeatureRoot: '/w/specs/002-b',
      featureJsonRoot: undefined,
    });
    expect(ordered).toEqual([{ featureRoot: '/w/specs/002-b', source: 'lastDocument' }]);
  });

  it('treats a blank string as nothing', () => {
    expect(orderScopeCandidates({ activeFeatureRoot: '   ' })).toEqual([]);
  });

  it('returns nothing when every source is empty', () => {
    expect(orderScopeCandidates({})).toEqual([]);
  });
});

describe('a folder reached twice is searched once', () => {
  it('keeps the higher priority when two sources name the same folder', () => {
    // The normal case, not an edge case: the document you are reading is almost
    // always also one of the folders under `specs/`. Searching it twice would
    // show every result in the picker twice.
    const ordered = orderScopeCandidates({
      activeFeatureRoot: '/w/specs/001-a',
      lastFeatureRoot: '/w/specs/001-a',
      allFeatureRoots: ['/w/specs/001-a', '/w/specs/002-b'],
    });
    expect(ordered).toEqual([
      { featureRoot: '/w/specs/001-a', source: 'activeDocument' },
      { featureRoot: '/w/specs/002-b', source: 'allFeatures' },
    ]);
  });

  it('recognises the same folder written two ways', () => {
    const ordered = orderScopeCandidates({
      activeFeatureRoot: '/w/specs/001-a',
      lastFeatureRoot: '/w/specs/./001-a',
    });
    expect(ordered).toHaveLength(1);
  });

  it('deduplicates repeats inside the wide list', () => {
    const ordered = orderScopeCandidates({
      allFeatureRoots: ['/w/specs/001-a', '/w/specs/001-a'],
    });
    expect(ordered).toHaveLength(1);
  });
});

describe('a feature folder is recognised by exactly three digits and a hyphen', () => {
  it('accepts the shape spec-kit creates', () => {
    expect(isFeatureDirName('001-speckit-id-links')).toBe(true);
    expect(isFeatureDirName('045-x')).toBe(true);
  });

  it('rejects shapes that are not feature folders', () => {
    // Must agree with `discoverFeatureScope`, or this command would offer to
    // navigate into a folder the editor does not treat as a feature.
    expect(isFeatureDirName('briefs')).toBe(false);
    expect(isFeatureDirName('1-x')).toBe(false);
    expect(isFeatureDirName('01-x')).toBe(false);
    expect(isFeatureDirName('0001-x')).toBe(false);
    expect(isFeatureDirName('001')).toBe(false);
  });

  it('agrees with discovery on every shape', () => {
    // The two rules are written out separately, in two modules, and they must
    // not drift. If discovery stops treating a folder as a feature, this
    // command must stop offering to search it on the same day.
    for (const name of ['001-x', '045-a-b', '0001-x', '01-x', '1-x', 'briefs', '001', 'x-001']) {
      const viaDiscovery =
        discoverFeatureScope({ fsPath: `/w/specs/${name}/spec.md`, scheme: 'file' }).featureRoot !==
        null;
      expect(isFeatureDirName(name)).toBe(viaDiscovery);
    }
  });
});
