/**
 * Copyright (c) 2025-2026 Agentic Minds
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

/**
 * "Flow text" rendering for soft breaks.
 *
 * A single newline inside a markdown paragraph is a soft wrap: CommonMark
 * renders it as a space, and only a blank line starts a new paragraph.
 * `breaks: false` on the markdown parser already stops that newline becoming a
 * hardBreak node, but the newline itself stays inside the ProseMirror text node
 * and prosemirror-view's stylesheet sets `white-space: break-spaces` on the
 * editor, which draws it as a real line break.
 *
 * Toggling this class lets the `body.md4h-flow-text .markdown-editor` rule in
 * editor.css relax white-space to `normal`, so the newline collapses to a
 * space. It is presentation only: nothing is rewritten, so the newline survives
 * the markdown round-trip and the file still reads well as plain text.
 */
export const SOFT_BREAK_FLOW_CLASS = 'md4h-flow-text';

/**
 * Applies (or removes) flow-text rendering.
 *
 * @param enabled Value of `speckitForHumans.softBreaks.renderAsSpace`.
 * @param root Element carrying the class. Defaults to `document.body`.
 */
export function applySoftBreakFlow(enabled: boolean, root?: HTMLElement): void {
  const target = root ?? document.body;
  if (!target) return;
  target.classList.toggle(SOFT_BREAK_FLOW_CLASS, enabled);
}
