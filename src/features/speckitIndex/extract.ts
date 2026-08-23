/**
 * Definition extraction (FR-011, FR-012, FR-005).
 *
 * Line-scans RAW markdown for the six syntaxes the corpus actually uses. Runs on
 * the extension host, because the webview cannot read a file, but is itself pure
 * — text and a path in, sites out — so it needs no VS Code API and no editor.
 *
 * Why line-scanning rather than parsing: the artifacts being scanned are mostly
 * not open in an editor, so there is no parsed document to walk, and parsing
 * every file in a feature folder to find bolded list items would cost far more
 * than the 3.5ms this takes for the largest real folder.
 *
 * The recorded `line` is in RAW FILE COORDINATES and is host-side only. It must
 * never be sent to the webview as a navigation instruction: content is rewritten
 * twice on its way in — the blank-line policy collapses runs and the frontmatter
 * wrapper inserts two lines — so measured against the corpus roughly 6.5% of
 * files would carry a silently wrong line number.
 */

import { createFenceTracker } from '../../shared/blankLinePolicy';
import { tokenize } from '../../shared/speckitIds/tokenizer';

/** The six syntaxes, plus the derived user-story heading. */
export type DefinitionKind =
  | 'bullet'
  | 'checkboxBare'
  | 'checkboxBold'
  | 'heading'
  | 'tableRow'
  | 'paragraphBold'
  | 'userStoryHeading';

export interface DefinitionSite {
  /** For `userStoryHeading` this is synthesized — the token appears nowhere in the text. */
  readonly id: string;
  /** Absolute path of the artifact that declares it. */
  readonly fsPath: string;
  /** Zero-based, raw-file coordinates. Host-side use only. */
  readonly line: number;
  readonly kind: DefinitionKind;
  /** Present for heading kinds, for the text-anchored reveal. */
  readonly headingText?: string;
}

const HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
/**
 * `### User Story 2 - Reopen the last folder (Priority: P2)`.
 *
 * The `(Priority: P<n>)` fragment is a definition ornament, never a token, and
 * the story identifier itself appears nowhere in the line — it has to be
 * synthesized, which is the whole of FR-012.
 */
const USER_STORY_HEADING = /^User\s+Story\s+(\d+)\b/i;
const CHECKBOX = /^\s*[-*+]\s+\[[ xX]\]\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const TABLE_ROW = /^\s*\|(.*)$/;
const TABLE_DELIMITER_CELL = /^:?-{2,}:?$/;

/**
 * The identifier a piece of text OPENS with, or null.
 *
 * Reuses the shared recognizer rather than a second pattern, so a definition and
 * a reference can never disagree about what an identifier is. Requiring the
 * token to start at offset 0 is what keeps `The read path covers FR-001/002`
 * from registering as a definition of `FR-001`.
 */
function leadingId(text: string): string | null {
  const trimmed = text.trimStart();
  if (trimmed === '') {
    return null;
  }
  const first = tokenize(trimmed)[0];
  return first && first.from === 0 ? first.id : null;
}

/** Strip one layer of bold or code emphasis from the front of a fragment. */
function unwrapLeadingEmphasis(text: string): string {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('**')) {
    return trimmed.slice(2);
  }
  if (trimmed.startsWith('`')) {
    return trimmed.slice(1);
  }
  return trimmed;
}

function opensWithBold(text: string): boolean {
  const trimmed = text.trimStart();
  // A bold run that never closes is not bold. `**` alone at the start of a line
  // of prose happens, and treating it as a definition would invent targets.
  return trimmed.startsWith('**') && trimmed.indexOf('**', 2) > 0;
}

/** The first cell of a table row, with backticks or bold stripped. */
function firstTableCell(rest: string): string | null {
  const cell = rest.split('|')[0].trim();
  if (cell === '' || TABLE_DELIMITER_CELL.test(cell)) {
    return null;
  }
  // Bare, backticked and bolded first cells all occur. Matching only the bare
  // form loses the entire digit-free precondition family.
  return cell.replace(/^\*\*/, '').replace(/\*\*$/, '').replace(/^`/, '').replace(/`$/, '');
}

/** One line's definition, or null. Fenced lines never reach here. */
function siteForLine(line: string, index: number, fsPath: string): DefinitionSite | null {
  const heading = HEADING.exec(line);
  if (heading) {
    const headingText = heading[2].trim();
    const story = USER_STORY_HEADING.exec(headingText);
    if (story) {
      return {
        id: `US${story[1]}`,
        fsPath,
        line: index,
        kind: 'userStoryHeading',
        headingText,
      };
    }
    const id = leadingId(unwrapLeadingEmphasis(headingText));
    return id ? { id, fsPath, line: index, kind: 'heading', headingText } : null;
  }

  const checkbox = CHECKBOX.exec(line);
  if (checkbox) {
    const rest = checkbox[1];
    if (opensWithBold(rest)) {
      const id = leadingId(unwrapLeadingEmphasis(rest));
      return id ? { id, fsPath, line: index, kind: 'checkboxBold' } : null;
    }
    const id = leadingId(rest);
    return id ? { id, fsPath, line: index, kind: 'checkboxBare' } : null;
  }

  const bullet = BULLET.exec(line);
  if (bullet) {
    // A plain bullet declares only when its FIRST inline element is the bolded
    // identifier. A bare identifier opening an ordinary bullet is prose — the
    // checkbox form above is the only place a bare identifier declares.
    if (!opensWithBold(bullet[1])) {
      return null;
    }
    const id = leadingId(unwrapLeadingEmphasis(bullet[1]));
    // The trailing colon is optional: `- **BR-1** Storage MUST…` is a real
    // definition, and a colon-anchored matcher misses that family entirely.
    return id ? { id, fsPath, line: index, kind: 'bullet' } : null;
  }

  const table = TABLE_ROW.exec(line);
  if (table) {
    const cell = firstTableCell(table[1]);
    const id = cell === null ? null : leadingId(cell);
    // Only when the cell is *nothing but* the identifier. A prose cell that
    // happens to open with one is a reference.
    return id && cell !== null && cell.trim() === id
      ? { id, fsPath, line: index, kind: 'tableRow' }
      : null;
  }

  if (opensWithBold(line)) {
    // The sixth syntax: a bolded identifier opening a PARAGRAPH rather than a
    // list item. Its absence held one family's resolution at 50% and another's
    // at 71%.
    const id = leadingId(unwrapLeadingEmphasis(line));
    return id ? { id, fsPath, line: index, kind: 'paragraphBold' } : null;
  }

  return null;
}

/**
 * Every definition in one artifact, in file order.
 *
 * Fenced code is skipped, using the same state machine the blank-line policy
 * uses. An identifier shown as an example inside a fenced block is not a
 * navigation target (FR-005), and a second fence implementation would eventually
 * disagree with the first.
 */
export function extractDefinitions(text: string, fsPath: string): DefinitionSite[] {
  const sites: DefinitionSite[] = [];
  const fences = createFenceTracker();
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const fence = fences.observe(line);
    if (fence.isDelimiter || fence.inFence) {
      continue;
    }
    const site = siteForLine(line, index, fsPath);
    if (site) {
      sites.push(site);
    }
  }

  return sites;
}
