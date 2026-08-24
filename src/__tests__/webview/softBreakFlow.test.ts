/**
 * @jest-environment jsdom
 */

/**
 * Copyright (c) 2025-2026 Agentic Minds
 *
 * Licensed under the MIT License. See LICENSE file in the project root for details.
 */

import * as fs from 'fs';
import * as path from 'path';
import { applySoftBreakFlow, SOFT_BREAK_FLOW_CLASS } from '../../webview/utils/softBreakFlow';
import { createSpeckitEditor } from './helpers/speckitEditorHarness';

describe('soft-break flow text', () => {
  afterEach(() => {
    document.body.className = '';
  });

  describe('applySoftBreakFlow', () => {
    it('adds the class when enabled', () => {
      applySoftBreakFlow(true);
      expect(document.body.classList.contains(SOFT_BREAK_FLOW_CLASS)).toBe(true);
    });

    it('removes the class when disabled', () => {
      document.body.classList.add(SOFT_BREAK_FLOW_CLASS);
      applySoftBreakFlow(false);
      expect(document.body.classList.contains(SOFT_BREAK_FLOW_CLASS)).toBe(false);
    });

    it('is idempotent', () => {
      applySoftBreakFlow(true);
      applySoftBreakFlow(true);
      expect(document.body.className.split(/\s+/).filter(Boolean)).toEqual([SOFT_BREAK_FLOW_CLASS]);
    });

    it('honours an explicit root element', () => {
      const root = document.createElement('div');
      applySoftBreakFlow(true, root);
      expect(root.classList.contains(SOFT_BREAK_FLOW_CLASS)).toBe(true);
      expect(document.body.classList.contains(SOFT_BREAK_FLOW_CLASS)).toBe(false);
    });
  });

  describe('stylesheet', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../webview/editor.css'), 'utf8');

    it('relaxes white-space on the editor root under the flow class', () => {
      // The whole feature is this one rule; if the selector or the class name
      // drifts apart from softBreakFlow.ts, the setting silently does nothing.
      expect(css).toMatch(
        new RegExp(
          `body\\.${SOFT_BREAK_FLOW_CLASS}\\s+\\.markdown-editor\\s*\\{[^}]*white-space:\\s*normal`
        )
      );
    });
  });

  describe('document round-trip', () => {
    // Flow text is presentation only. The newline must stay in the markdown so
    // the file keeps its hard wraps when read in a plain text editor.
    it('keeps soft-wrapped source newlines byte-identical', () => {
      const source = 'A long sentence\nthat is split across\nseveral source lines.';
      const editor = createSpeckitEditor(source);
      editor.commands.setContent(source, { contentType: 'markdown' });

      expect(editor.getMarkdown()).toBe(source);
      // Parsed as ONE paragraph holding real newlines - not hardBreak nodes.
      expect(editor.getJSON()).toEqual({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: source }] }],
      });
    });

    it('still starts a new paragraph on a blank line', () => {
      const source = 'First para.\n\nSecond para.';
      const editor = createSpeckitEditor(source);
      editor.commands.setContent(source, { contentType: 'markdown' });

      expect(editor.getJSON().content).toHaveLength(2);
      expect(editor.getMarkdown()).toBe(source);
    });
  });
});
