/**
 * Reading spec-kit's own answer to "which feature am I in".
 *
 * Spec Kit resolves the active feature in exactly two steps, in
 * `.specify/scripts/bash/common.sh:get_feature_paths`:
 *
 *   1. the `SPECIFY_FEATURE_DIRECTORY` environment variable
 *   2. `.specify/feature.json` -> `feature_directory`
 *   3. hard error
 *
 * Notably it never reads the git branch. `get_current_branch` returns
 * `$SPECIFY_FEATURE` or nothing, and `CURRENT_BRANCH` is derived BACKWARDS from
 * the resolved directory's basename. So the branch is an output of the
 * resolution, not an input to it.
 *
 * Step 1 is skipped here on purpose. An environment variable exported in one
 * terminal is not visible to the extension host, so honouring it would produce
 * an answer that changes depending on how VS Code happened to be launched.
 *
 * `feature.json` is also gitignored — it is per-checkout state — so its absence
 * is the normal case on a fresh clone, not an error.
 */

/** Where spec-kit keeps the pointer, relative to the project root. */
export const FEATURE_JSON_RELATIVE_PATH = '.specify/feature.json';

/**
 * The `feature_directory` value, or null.
 *
 * Mirrors spec-kit's own parser chain (jq, then python, then grep/sed) in
 * spirit: try a real JSON parse, and fall back to a single-line regex when the
 * file is malformed. A half-written file mid-save should degrade to "no
 * pointer", never to a thrown error on a navigation keypress.
 */
export function parseFeatureDirectory(contents: string): string | null {
  const viaJson = parseViaJson(contents);
  if (viaJson !== null) {
    return viaJson;
  }
  return parseViaRegex(contents);
}

function parseViaJson(contents: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const value = (parsed as Record<string, unknown>).feature_directory;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

const FEATURE_DIRECTORY_LINE = /"feature_directory"\s*:\s*"([^"]*)"/;

function parseViaRegex(contents: string): string | null {
  const match = FEATURE_DIRECTORY_LINE.exec(contents);
  if (!match) {
    return null;
  }
  const value = match[1].trim();
  return value === '' ? null : value;
}
