/**
 * What identifier did the user actually ask for?
 *
 * Two sources, in order: whatever is selected in an editor, then the clipboard.
 * Selection wins because when an identifier is already highlighted in front of
 * you, being made to copy it first is pure ceremony. The clipboard is the
 * fallback that makes this work from anywhere VS Code cannot see into — a
 * terminal, an AI assistant panel, another window.
 *
 * Everything here is pure so the precedence rule can be tested without a
 * running editor.
 */

import { recognizeToIds } from '../../shared/speckitIds/expand';

/**
 * The text to search for, or `''` when neither source offers anything.
 *
 * A selection of nothing but whitespace counts as no selection. Dragging past
 * the end of a line is common and must not shadow a perfectly good clipboard.
 */
export function pickQueryText(
  selection: string | null | undefined,
  clipboard: string | null | undefined
): string {
  const fromSelection = (selection ?? '').trim();
  if (fromSelection !== '') {
    return fromSelection;
  }
  return (clipboard ?? '').trim();
}

/**
 * The identifiers in a piece of text, deduplicated, in the order they appear.
 *
 * Runs the same recognition grammar the editor's links use, so `T042`,
 * `see T042`, and `T042-T044` all behave exactly as they would if the text had
 * been rendered in the editor. That consistency is the point: an identifier
 * this command refuses to find is one the editor would also refuse to link.
 *
 * Deduplication is by canonical id. `T042 and T042 again` is one destination,
 * and offering it twice in a picker would be noise.
 */
export function idsFromQuery(text: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of recognizeToIds(text)) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}
