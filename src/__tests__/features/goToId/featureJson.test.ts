/**
 * Reading spec-kit's own feature pointer.
 *
 * Spec Kit resolves the active feature from `SPECIFY_FEATURE_DIRECTORY`, then
 * `.specify/feature.json`, then errors. It never reads the git branch:
 * `get_current_branch` returns `$SPECIFY_FEATURE` or nothing, and the branch
 * name is derived BACKWARDS from the resolved directory. These tests pin the
 * one step of that chain we can honour from an extension host.
 *
 * The file is gitignored per-checkout state, so absent and malformed both have
 * to degrade to "no pointer" rather than to an error on a keypress.
 */

import { parseFeatureDirectory } from '../../../features/goToId/featureJson';

describe('the pointer is read from well-formed JSON', () => {
  it('reads the value spec-kit writes', () => {
    expect(parseFeatureDirectory('{"feature_directory": "specs/001-speckit-id-links"}')).toBe(
      'specs/001-speckit-id-links'
    );
  });

  it('reads a pretty-printed file, which is what the CLI produces by hand', () => {
    const contents = ['{', '  "feature_directory": "specs/002-launch"', '}'].join('\n');
    expect(parseFeatureDirectory(contents)).toBe('specs/002-launch');
  });

  it('ignores the other keys a future spec-kit may add', () => {
    expect(parseFeatureDirectory('{"other": 1, "feature_directory": "specs/003-x"}')).toBe(
      'specs/003-x'
    );
  });

  it('trims a value written with stray whitespace', () => {
    expect(parseFeatureDirectory('{"feature_directory": "  specs/004-x  "}')).toBe('specs/004-x');
  });
});

describe('anything unusable reads as no pointer, never as an error', () => {
  it('returns null for an empty file', () => {
    expect(parseFeatureDirectory('')).toBeNull();
  });

  it('returns null when the key is absent', () => {
    expect(parseFeatureDirectory('{"something_else": "specs/001-x"}')).toBeNull();
  });

  it('returns null when the value is empty', () => {
    expect(parseFeatureDirectory('{"feature_directory": ""}')).toBeNull();
  });

  it('returns null when the value is not a string', () => {
    expect(parseFeatureDirectory('{"feature_directory": 7}')).toBeNull();
  });

  it('returns null for JSON that is not an object', () => {
    expect(parseFeatureDirectory('"specs/001-x"')).toBeNull();
    expect(parseFeatureDirectory('null')).toBeNull();
  });
});

describe('a half-written file still gives up its value', () => {
  it('falls back to a line scan when the JSON will not parse', () => {
    // Mirrors spec-kit's own last-resort grep/sed branch. A file caught
    // mid-save must degrade to a usable answer, not to a thrown exception on a
    // navigation keypress.
    expect(parseFeatureDirectory('{"feature_directory": "specs/001-x",')).toBe('specs/001-x');
  });

  it('returns null when even the line scan finds nothing', () => {
    expect(parseFeatureDirectory('{"feature_dir')).toBeNull();
  });
});
