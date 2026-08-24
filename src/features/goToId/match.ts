/**
 * Matching recognised identifiers against indexed definitions.
 *
 * Split out from the command so the interesting rules - case folding, ordering,
 * duplicate suppression - can be tested without VS Code.
 */

import type { DefinitionSite } from '../speckitIndex/extract';

/** A definition plus the feature folder it was found in, for display. */
export interface LocatedDefinition {
  readonly site: DefinitionSite;
  readonly featureRoot: string;
}

/**
 * Definitions whose id is one of `ids`, in the order the ids were written.
 *
 * Case-insensitive. The recognition grammar canonicalises what it emits, but
 * the text being searched came from a clipboard, and a person who copied
 * `t042` out of a chat log means the same thing as one who copied `T042`.
 *
 * One identifier can legitimately have several definitions - the same task id
 * declared in two artifacts of the same feature, or the same id in two features
 * when the search has widened to the whole workspace. All of them are returned;
 * choosing between them is the picker's job, not this function's.
 */
export function matchDefinitions(
  definitions: readonly LocatedDefinition[],
  ids: readonly string[]
): LocatedDefinition[] {
  if (ids.length === 0) {
    return [];
  }
  const byId = new Map<string, LocatedDefinition[]>();
  for (const located of definitions) {
    const key = located.site.id.toLowerCase();
    const bucket = byId.get(key);
    if (bucket) {
      bucket.push(located);
    } else {
      byId.set(key, [located]);
    }
  }

  const matched: LocatedDefinition[] = [];
  for (const id of ids) {
    matched.push(...(byId.get(id.toLowerCase()) ?? []));
  }
  return matched;
}

/**
 * Drop definitions that name the same place twice.
 *
 * The candidate chain deliberately overlaps - the active document's folder is
 * usually also one of the "all features" folders - and the same artifact can be
 * reached through two feature roots when a document qualifies a sibling. Both
 * are normal, and neither should show the user the same row twice.
 */
export function dedupeDefinitions(definitions: readonly LocatedDefinition[]): LocatedDefinition[] {
  const seen = new Set<string>();
  const unique: LocatedDefinition[] = [];
  for (const located of definitions) {
    const key = `${located.site.id} ${located.site.fsPath} ${located.site.line}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(located);
  }
  return unique;
}
