import type { Editor } from '@tiptap/core';

/**
 * Bring an arbitrary document position into view.
 *
 * Node-type agnostic, which is the whole point. The existing
 * `scrollToHeading` helper climbs the DOM looking for an `h1`–`h6` and applies
 * a sticky-toolbar offset only when it finds one. At a position inside a list
 * item that climb walks `li → ul → .ProseMirror → #editor → body → html` and
 * exits empty-handed, so the offset is skipped and the target can land beneath
 * the toolbar. Requirement FR-022 has to reach bullets, checkbox items and
 * table cells, so it needs this instead.
 *
 * Extracted from the search overlay, which already did this correctly. The audit
 * overlay had a third copy of the same logic. Both now call here, so there is
 * one implementation rather than three.
 *
 * @param editor The editor holding the position.
 * @param from Start of the range to reveal.
 * @param to End of the range. Defaults to `from`, giving a caret rather than a
 *   selection.
 * @param options.select Whether to move the selection. Pass false when the
 *   caller has already made its own — the audit overlay uses a node selection
 *   for image issues, and a text selection here would silently replace it.
 */
export function scrollToPos(
  editor: Editor,
  from: number,
  to: number = from,
  options: { select?: boolean } = {}
): void {
  if (options.select !== false) {
    editor.commands.setTextSelection({ from, to });
  }

  // ProseMirror's own scroll first. It handles the common case and does not
  // depend on the DOM being laid out yet.
  try {
    editor.view.dispatch(editor.state.tr.scrollIntoView());
  } catch {
    // A stale position can throw here. The DOM path below still has a chance.
  }

  // Then centre it in the viewport. `domAtPos` is position-based rather than
  // node-type-based, which is why this works inside a task item or a table cell
  // where the heading-specific helper does not.
  //
  // Order matters here, and the version this was extracted from had it wrong.
  // It asked `coordsAtPos` first and bailed out entirely if that failed — but
  // coordinates are only needed for the window-scroll fallback, and
  // `coordsAtPos` fails whenever layout is unavailable, throwing
  // "target.getClientRects is not a function". The element path would have
  // worked fine in exactly those cases. Try the element first.
  let element: HTMLElement | null = null;
  try {
    const at = editor.view.domAtPos(from);
    const node = (at?.node ?? null) as Node | null;
    element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null);
  } catch {
    element = null;
  }

  if (element && typeof element.scrollIntoView === 'function') {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Fallback when there is no element to scroll, or no scrollIntoView to call.
  // Offsetting by 30% of the viewport keeps the target clear of the sticky
  // toolbar. Needs coordinates, so this is where they are fetched.
  try {
    const coords = editor.view.coordsAtPos(from);
    if (coords) {
      window.scrollTo({
        top: coords.top + window.scrollY - window.innerHeight * 0.3,
        behavior: 'smooth',
      });
    }
  } catch {
    // No layout available and no element resolved. The ProseMirror scroll above
    // was the last chance; nothing further to try.
  }
}
