/**
 * A real TipTap editor, wired the way the production webview wires it, with the
 * spec-kit ID link extension switchable on and off.
 *
 * Copied from the harness in `aiContextReference.realEditor.test.ts` rather than
 * invented fresh: the byte-identity proof (FR-024, SC-005) is only worth
 * anything if the editor under test parses and serializes markdown through the
 * same `@tiptap/markdown` MarkdownManager production uses. A stub would prove
 * nothing.
 *
 * Not a test file — no `.test.ts` suffix, so jest does not collect it.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { ListKit } from '@tiptap/extension-list';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import Link from '@tiptap/extension-link';
import { MarkdownParagraph } from '../../../webview/extensions/markdownParagraph';
import { OrderedListMarkdownFix } from '../../../webview/extensions/orderedListMarkdownFix';
import { CustomImage } from '../../../webview/extensions/customImage';
import { SpeckitIdLinks } from '../../../webview/extensions/speckitIdLinks';
import { installBlankLineLexerNormalizer } from '../../../webview/utils/markedLexerNormalizer';

export interface SpeckitEditorOptions {
  /** Register the ID-link extension. Defaults to true. */
  readonly withExtension?: boolean;
}

export function createSpeckitEditor(
  initialMarkdown: string,
  options: SpeckitEditorOptions = {}
): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);

  const extensions = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      paragraph: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      listKeymap: false,
      link: false,
      undoRedo: { depth: 100 },
    }),
    MarkdownParagraph,
    CustomImage,
    Markdown.configure({ markedOptions: { gfm: true, breaks: false } }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    ListKit.configure({ orderedList: false, taskItem: { nested: true } }),
    OrderedListMarkdownFix,
    // Production configures Link exactly this way. The class is what the ID
    // decoration reuses, so an author-written link and a decorated token must
    // be indistinguishable in the DOM (FR-020, SC-008).
    Link.configure({ openOnClick: false, HTMLAttributes: { class: 'markdown-link' } }),
  ];

  if (options.withExtension !== false) {
    extensions.push(SpeckitIdLinks);
  }

  const editor = new Editor({
    element,
    extensions,
    content: '',
    contentType: 'markdown',
  });

  const markdownStorage = editor as unknown as {
    markdown?: { instance?: unknown };
    storage?: { markdown?: { instance?: unknown } };
  };
  const markedInstance =
    markdownStorage.markdown?.instance ?? markdownStorage.storage?.markdown?.instance;
  if (markedInstance) {
    installBlankLineLexerNormalizer(markedInstance);
  }

  if (initialMarkdown) {
    editor.commands.setContent(initialMarkdown, { contentType: 'markdown' });
  }
  return editor;
}

/** Every element the ID-link decoration produced, in document order. */
export function speckitLinkElements(editor: Editor): HTMLElement[] {
  return Array.from(editor.view.dom.querySelectorAll<HTMLElement>('[data-speckit-id]'));
}

/** The identifiers the decoration linked, in document order. */
export function speckitLinkedIds(editor: Editor): string[] {
  return speckitLinkElements(editor).map(el => el.getAttribute('data-speckit-id') ?? '');
}
