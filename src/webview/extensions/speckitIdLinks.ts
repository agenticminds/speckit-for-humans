/**
 * Spec-kit ID links — the view-only decoration layer (FR-005, FR-006, FR-014,
 * FR-020, FR-024).
 *
 * A recognized, resolvable identifier is presented with the editor's EXISTING
 * link class plus a data attribute. It is a `Decoration.inline` and never a
 * mark. That single choice is what makes the whole feature possible: a mark
 * lives in `state.doc` and would be serialized into the file, while a decoration
 * lives in the view and cannot reach disk.
 *
 * Two hard constraints on this module:
 *
 * 1. **It never dispatches a document-changing transaction.** That is what makes
 *    the refresh loop terminate — index push, re-decorate, stop — and FR-024
 *    requires it regardless.
 * 2. **The decoration carries no `href`.** An unrecognised href shape falls
 *    through to the click handler's local-file branch, which cannot carry a
 *    position, opens the plain text editor, and raises a *File not found* dialog
 *    on a miss: three requirement violations at once.
 */

import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import { tokenize } from '../../shared/speckitIds/tokenizer';
import { getDocumentPath } from '../utils/documentPath';
import type { DefinitionKind, DefinitionSite } from '../../features/speckitIndex/extract';

/** The `speckitIndex` push, as the webview receives it (C-msg-2). */
export interface SpeckitIndexMessage {
  readonly revision: number;
  readonly featureRoot: string | null;
  readonly definitions: readonly DefinitionSite[];
}

interface HeldIndex {
  readonly revision: number;
  readonly featureRoot: string;
  /** First entry wins: the host emits candidates in resolution order. */
  readonly byId: Map<string, DefinitionSite>;
}

export const speckitIdLinksPluginKey = new PluginKey<DecorationSet>('speckitIdLinks');

/**
 * Module state rather than plugin state, deliberately.
 *
 * One webview shows one document, so there is exactly one index in play, and
 * holding it here lets the click handler and the reveal handler read it without
 * a reference to the editor. The views are tracked so an index arriving from the
 * host can repaint whatever is on screen.
 */
let heldIndex: HeldIndex | null = null;
const activeViews = new Set<EditorView>();

/** Every marked-up node type whose contents must never be decorated. */
const SKIPPED_MARKS = new Set(['code', 'link']);

/** Containers whose FIRST child block is the one a definition can open. */
const LEADING_CONTAINERS = new Set(['listItem', 'taskItem', 'tableCell', 'tableHeader']);

/**
 * Take an index push from the host.
 *
 * @returns whether the push was applied. A caller does not need the answer; it
 *   exists so the revision rules are directly assertable.
 */
export function applySpeckitIndex(message: unknown): boolean {
  const push = message as Partial<SpeckitIndexMessage> | null | undefined;
  if (!push || typeof push.revision !== 'number') {
    return false;
  }

  if (heldIndex) {
    if (push.revision === heldIndex.revision) {
      // A duplicate. Nothing to do, and repainting would be wasted work.
      return false;
    }
    if (push.revision < heldIndex.revision) {
      // Backwards. Treated as LINK NOTHING, never as continuity (C-msg-2d): a
      // webview can be reloaded even with retainContextWhenHidden, and carrying
      // on with an index of unknown vintage would present links to definitions
      // that may no longer exist. The next forward push restores service.
      heldIndex = null;
      repaintAll();
      return false;
    }
  }

  const featureRoot = typeof push.featureRoot === 'string' ? push.featureRoot : null;
  if (!featureRoot) {
    // No feature folder means nothing links (FR-019, C-msg-2b).
    heldIndex = null;
    repaintAll();
    return true;
  }

  const byId = new Map<string, DefinitionSite>();
  for (const site of push.definitions ?? []) {
    if (site && typeof site.id === 'string' && !byId.has(site.id)) {
      byId.set(site.id, site);
    }
  }

  heldIndex = { revision: push.revision, featureRoot, byId };
  repaintAll();
  return true;
}

/** Forget the index. Test helper, and the reset path for a document swap. */
export function resetSpeckitIndex(): void {
  heldIndex = null;
  repaintAll();
}

/** The definition an identifier resolves to, or null for plain prose (FR-010). */
export function lookupSpeckitDefinition(id: string): DefinitionSite | null {
  return heldIndex?.byId.get(id) ?? null;
}

/**
 * Repaint one editor's decorations.
 *
 * The transaction carries only plugin meta, so `docChanged` is false, the
 * editor's update event does not fire, and no sync is attempted (C-msg-7).
 */
export function refreshSpeckitIdLinks(editor: Editor): void {
  repaint(editor.view);
}

function repaint(view: EditorView): void {
  try {
    view.dispatch(view.state.tr.setMeta(speckitIdLinksPluginKey, { repaint: true }));
  } catch {
    // A view torn down mid-flight. Nothing to repaint, and never an interruption.
  }
}

function repaintAll(): void {
  for (const view of activeViews) {
    repaint(view);
  }
}

/**
 * Is this definition in the document the webview is showing?
 *
 * Sites carry an absolute path; the webview knows its own path only as the
 * workspace-relative string the host sends in `update`. Comparing by suffix
 * covers both, including a document outside the workspace, where the host sends
 * the absolute path unchanged.
 */
function isCurrentDocument(fsPath: string): boolean {
  const own = getDocumentPath();
  if (!own) {
    return false;
  }
  const site = fsPath.replace(/\\/g, '/');
  const here = own.replace(/\\/g, '/');
  return site === here || site.endsWith(`/${here}`);
}

/** Is this position the leading inline content of its own block, and of its item? */
function atLeadingContent($from: ResolvedPos): boolean {
  if ($from.parentOffset !== 0) {
    return false;
  }
  if ($from.depth >= 1) {
    const container = $from.node($from.depth - 1);
    if (LEADING_CONTAINERS.has(container.type.name) && $from.index($from.depth - 1) !== 0) {
      return false;
    }
  }
  return true;
}

/**
 * Does the block this token sits at the head of have the shape of the syntax
 * that defines it? (FR-014)
 *
 * Deciding from block shape is what removes any dependence on raw line numbers,
 * which are wrong in roughly 6.5% of real files. The kind check is what stops a
 * paragraph that merely opens with an identifier — `FR-001 is discussed below` —
 * from being mistaken for the bullet that defines it.
 */
function shapeMatchesKind(
  kind: DefinitionKind,
  shape: { isHeading: boolean; inListItem: boolean; inTaskItem: boolean; inTableCell: boolean },
  hasBold: boolean
): boolean {
  switch (kind) {
    case 'bullet':
      return hasBold && shape.inListItem;
    case 'checkboxBold':
      return hasBold && shape.inTaskItem;
    case 'checkboxBare':
      return shape.inTaskItem;
    case 'paragraphBold':
      return hasBold && !shape.inListItem && !shape.inTaskItem && !shape.inTableCell;
    case 'heading':
      return shape.isHeading;
    case 'tableRow':
      return shape.inTableCell;
    case 'userStoryHeading':
      // The identifier appears nowhere in a user-story heading — it is
      // synthesized — so there is never a token there to suppress.
      return false;
    default:
      return false;
  }
}

function isSelfReference(
  doc: ProseMirrorNode,
  from: number,
  textNode: ProseMirrorNode,
  site: DefinitionSite
): boolean {
  if (!isCurrentDocument(site.fsPath)) {
    return false;
  }

  let $from: ResolvedPos;
  try {
    $from = doc.resolve(from);
  } catch {
    return false;
  }

  if (!atLeadingContent($from)) {
    return false;
  }

  const shape = { isHeading: false, inListItem: false, inTaskItem: false, inTableCell: false };
  shape.isHeading = $from.parent.type.name === 'heading';
  for (let depth = $from.depth; depth >= 0; depth--) {
    switch ($from.node(depth).type.name) {
      case 'listItem':
        shape.inListItem = true;
        break;
      case 'taskItem':
        shape.inTaskItem = true;
        break;
      case 'tableCell':
      case 'tableHeader':
        shape.inTableCell = true;
        break;
      default:
        break;
    }
  }

  const hasBold = textNode.marks.some(
    mark => mark.type.name === 'bold' || mark.type.name === 'strong'
  );

  return shapeMatchesKind(site.kind, shape, hasBold);
}

function buildDecorations(doc: ProseMirrorNode): DecorationSet {
  if (!heldIndex) {
    return DecorationSet.empty;
  }

  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    // Stage 0 exclusion: markdown structure is invisible to a text scanner, so
    // code and existing links are removed here rather than inside the grammar.
    if (node.type.spec.code) {
      return false;
    }
    if (!node.isText || !node.text) {
      return true;
    }
    if (node.marks.some(mark => SKIPPED_MARKS.has(mark.type.name))) {
      return false;
    }

    for (const token of tokenize(node.text)) {
      const site = lookupSpeckitDefinition(token.id);
      if (!site) {
        continue;
      }
      const from = pos + token.from;
      if (isSelfReference(doc, from, node, site)) {
        continue;
      }
      decorations.push(
        Decoration.inline(from, pos + token.to, {
          nodeName: 'a',
          class: 'markdown-link',
          'data-speckit-id': token.id,
        })
      );
    }
    return false;
  });

  return DecorationSet.create(doc, decorations);
}

/** Where an identifier is defined in THIS document, or null (C-msg-4b). */
export interface SpeckitRevealTarget {
  readonly id: string;
  readonly kind?: string;
  readonly headingText?: string;
}

/**
 * Locate a definition in the editor's own parsed document.
 *
 * Text-anchored, never position-anchored: the host holds a `TextDocument`, not a
 * ProseMirror document, so it cannot produce a valid position, and the raw line
 * it does hold is wrong often enough to be unusable (C-msg-4a).
 */
export function findSpeckitDefinitionPos(
  editor: Editor,
  target: SpeckitRevealTarget
): number | null {
  const storyNumber = target.kind === 'userStoryHeading' ? /^US(\d+)/.exec(target.id)?.[1] : null;
  const heading = target.headingText?.trim();
  let found: number | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (found !== null) {
      return false;
    }
    if (!node.isBlock || !node.inlineContent) {
      return true;
    }
    const text = node.textContent.trim();
    if (text === '') {
      return true;
    }

    if (storyNumber) {
      const matchesHeading = heading ? text === heading : false;
      if (matchesHeading || new RegExp(`^User\\s+Story\\s+${storyNumber}\\b`, 'i').test(text)) {
        found = pos + 1;
      }
      return true;
    }

    if (text.startsWith(target.id)) {
      const next = text.charAt(target.id.length);
      // A trailing word character means this is a longer identifier or a word
      // that merely begins with the same letters.
      if (next === '' || !/[A-Za-z0-9-]/.test(next)) {
        found = pos + 1;
      }
    }
    return true;
  });

  return found;
}

/**
 * The extension. Supplies decorations and nothing else — no commands, no
 * keymaps, no schema, and above all no transactions that touch the document.
 */
export const SpeckitIdLinks = Extension.create({
  name: 'speckitIdLinks',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: speckitIdLinksPluginKey,
        state: {
          init: (_config, state) => buildDecorations(state.doc),
          apply: (tr, previous, _oldState, newState) => {
            if (tr.getMeta(speckitIdLinksPluginKey) || tr.docChanged) {
              return buildDecorations(newState.doc);
            }
            return previous.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return speckitIdLinksPluginKey.getState(state) ?? DecorationSet.empty;
          },
        },
        view(view) {
          activeViews.add(view);
          return {
            destroy() {
              activeViews.delete(view);
            },
          };
        },
      }),
    ];
  },
});
