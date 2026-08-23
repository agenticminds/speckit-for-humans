/**
 * @jest-environment jsdom
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TaskList } from '@tiptap/extension-list';
import { TaskItem } from '@tiptap/extension-list';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { scrollToPos } from '../../webview/utils/scrollToPos';

/**
 * Contract item C-msg-4f: the reveal must work at a position inside a list item,
 * a task item and a table cell — not only at a heading.
 *
 * This is why the reveal was extracted rather than reusing `scrollToHeading`.
 * That helper climbs the DOM looking for an `h1`–`h6` and applies its
 * sticky-toolbar offset only on finding one; inside a bullet the climb exits
 * empty-handed and the offset is skipped, leaving the target able to land under
 * the toolbar.
 */

describe('scrollToPos reveals non-heading positions (C-msg-4f)', () => {
  let editor: Editor;
  let scrolled: Array<{ tag: string; text: string }>;

  beforeEach(() => {
    scrolled = [];
    // jsdom has no layout, so scrollIntoView does not exist. Record calls
    // instead, which is what we actually want to assert: that a real element
    // was resolved from the position and asked to scroll.
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push({ tag: this.tagName.toLowerCase(), text: this.textContent ?? '' });
    };
  });

  afterEach(() => {
    editor?.destroy();
  });

  function build(content: string) {
    editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, TaskList, TaskItem, Table, TableRow, TableCell, TableHeader],
      content,
    });
    return editor;
  }

  /** Position of the first text node whose content matches. */
  function positionOf(target: string): number {
    let found = -1;
    editor.state.doc.descendants((node, pos) => {
      if (found === -1 && node.isText && node.text?.includes(target)) {
        found = pos + (node.text.indexOf(target) ?? 0);
        return false;
      }
      return true;
    });
    expect(found).toBeGreaterThanOrEqual(0);
    return found;
  }

  it('resolves an element for a position inside a bullet list item', () => {
    build('<ul><li><p>needle in a bullet</p></li></ul>');
    scrollToPos(editor, positionOf('needle'));
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0].text).toContain('needle');
  });

  it('resolves an element for a position inside a task item', () => {
    build('<ul data-type="taskList"><li data-checked="false"><p>needle in a task</p></li></ul>');
    scrollToPos(editor, positionOf('needle'));
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0].text).toContain('needle');
  });

  it('resolves an element for a position inside a table cell', () => {
    build(
      '<table><tbody><tr><td><p>needle in a cell</p></td><td><p>other</p></td></tr></tbody></table>'
    );
    scrollToPos(editor, positionOf('needle'));
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0].text).toContain('needle');
  });

  it('resolves an element for a position inside a heading, the case that already worked', () => {
    build('<h2>needle in a heading</h2>');
    scrollToPos(editor, positionOf('needle'));
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0].text).toContain('needle');
  });

  it('moves the selection to the requested position by default', () => {
    build('<ul><li><p>needle in a bullet</p></li></ul>');
    const pos = positionOf('needle');
    scrollToPos(editor, pos, pos + 6);
    expect(editor.state.selection.from).toBe(pos);
    expect(editor.state.selection.to).toBe(pos + 6);
  });

  it('leaves the selection alone when asked not to touch it', () => {
    // The audit overlay depends on this: it makes a node selection for an image
    // issue, and a text selection here would silently replace it.
    build('<p>first</p><ul><li><p>needle in a bullet</p></li></ul>');
    editor.commands.setTextSelection({ from: 1, to: 2 });
    const before = { from: editor.state.selection.from, to: editor.state.selection.to };

    scrollToPos(editor, positionOf('needle'), undefined, { select: false });

    expect(editor.state.selection.from).toBe(before.from);
    expect(editor.state.selection.to).toBe(before.to);
    expect(scrolled).toHaveLength(1);
  });

  it('does not throw on a position past the end of the document', () => {
    build('<p>short</p>');
    expect(() => scrollToPos(editor, 9999)).not.toThrow();
  });
});
