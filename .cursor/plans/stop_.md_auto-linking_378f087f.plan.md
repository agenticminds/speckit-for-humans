---
name: Stop .MD Auto-Linking
overview: "Fix TipTap Link extension auto-linking bare extensions like .MD/.md"
todos:
  - id: add-test-md-link
    content: Add failing test for .MD auto-linking
    status: done
  - id: implement-shouldAutoLink
    content: Configure Link extension with shouldAutoLink validation
    status: done
    dependencies:
      - add-test-md-link
  - id: verify-regressions
    content: Run link/markdown webview tests
    status: done
    dependencies:
      - implement-shouldAutoLink
---

# Stop .MD Auto-Linking

Prevent plain `.MD` text from being auto-converted into links by tightening link detection.

## Root Cause Analysis

**Finding:** The issue is in TipTap's `@tiptap/extension-link` extension, which uses [linkifyjs](https://linkify.js.org) for autolink detection. By default, `autolink: true` means any text resembling a TLD (like `.MD`, `.io`, `.com`) can trigger link creation.

**Code Location:** [src/webview/editor.ts#L432-L437](file:///Users/abhinav/code/speckit-for-humans-public/src/webview/editor.ts#L432-L437)

```typescript
Link.configure({
  openOnClick: false,
  HTMLAttributes: {
    class: 'markdown-link',
  },
}),
```

Currently, no `shouldAutoLink` or `isAllowedUri` validation is configured. The Link extension auto-links any URL-like pattern, including bare extensions like `.MD`, `.io`, etc.

**Why it happens:**
1. linkifyjs interprets `.MD` as a valid domain suffix (top-level domain)
2. Text like `filename.MD` or even bare `.MD` gets interpreted as a URL
3. TipTap applies the link mark automatically during typing/paste

## Solution

Add `shouldAutoLink` validation to the Link extension that:
1. Rejects bare extensions (text that is ONLY an extension like `.MD`, `.txt`, `.pdf`)
2. Requires actual URL patterns (protocol, domain structure) for auto-linking
3. Preserves explicit markdown links `[text](url)` which go through a different path

## TDD Approach

### Step 1: Add Failing Test (RED)

Create `src/__tests__/webview/linkAutolink.test.ts`:

```typescript
/**
 * @jest-environment jsdom
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Markdown } from '@tiptap/markdown';

describe('Link autolink prevention', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  describe('bare extensions should NOT become links', () => {
    const bareExtensions = ['.MD', '.md', '.txt', '.pdf', '.doc', '.io', '.ai'];

    bareExtensions.forEach(ext => {
      it(`should not auto-link bare extension "${ext}"`, () => {
        editor = new Editor({
          extensions: [
            StarterKit,
            Markdown,
            Link.configure({
              openOnClick: false,
              // TODO: Add shouldAutoLink config
            }),
          ],
        });

        editor.commands.setContent(`This is a ${ext} file`, { contentType: 'markdown' });
        
        const json = editor.getJSON();
        const hasLinkMark = JSON.stringify(json).includes('"type":"link"');
        expect(hasLinkMark).toBe(false);
      });
    });
  });

  describe('real URLs SHOULD become links', () => {
    const realUrls = [
      'https://example.com',
      'http://test.io',
      'https://docs.example.com/file.md',
      'www.example.com',
    ];

    realUrls.forEach(url => {
      it(`should auto-link real URL "${url}"`, () => {
        editor = new Editor({
          extensions: [
            StarterKit,
            Markdown,
            Link.configure({
              openOnClick: false,
              // TODO: Add shouldAutoLink config
            }),
          ],
        });

        editor.commands.setContent(`Visit ${url} for info`, { contentType: 'markdown' });
        
        // Real URLs should be linked
        const json = editor.getJSON();
        const hasLinkMark = JSON.stringify(json).includes('"type":"link"');
        expect(hasLinkMark).toBe(true);
      });
    });
  });

  describe('explicit markdown links should work', () => {
    it('should parse [text](url) as a link', () => {
      editor = new Editor({
        extensions: [
          StarterKit,
          Markdown,
          Link.configure({ openOnClick: false }),
        ],
      });

      editor.commands.setContent('[Click here](https://example.com)', { contentType: 'markdown' });
      
      const json = editor.getJSON();
      const hasLinkMark = JSON.stringify(json).includes('"type":"link"');
      expect(hasLinkMark).toBe(true);
    });
  });
});
```

### Step 2: Implement Fix (GREEN)

Update `src/webview/editor.ts` Link configuration:

```typescript
Link.configure({
  openOnClick: false,
  HTMLAttributes: {
    class: 'markdown-link',
  },
  shouldAutoLink: (url) => {
    // Reject bare extensions like ".MD", ".io", ".txt"
    // These are just file extensions, not real URLs
    if (/^\.[a-zA-Z]{2,4}$/i.test(url)) {
      return false;
    }
    
    // Reject patterns that look like "word.ext" without protocol
    // but allow "word.tld/path" or URLs with protocols
    const bareFilePattern = /^[^/]+\.[a-zA-Z]{2,4}$/i;
    const hasProtocol = /^(https?|ftp|mailto):/i.test(url);
    const hasPath = url.includes('/');
    const isWww = url.startsWith('www.');
    
    if (bareFilePattern.test(url) && !hasProtocol && !hasPath && !isWww) {
      // Could be "file.md" which isn't a real URL
      // Allow common TLDs like .com, .org, .net, .io
      const commonTlds = ['com', 'org', 'net', 'io', 'dev', 'co', 'app'];
      const ext = url.split('.').pop()?.toLowerCase();
      if (!commonTlds.includes(ext || '')) {
        return false;
      }
    }
    
    return true;
  },
}),
```

### Step 3: Refactor if Needed

If the logic becomes complex, extract to a utility:

```typescript
// src/webview/utils/linkValidation.ts
export function shouldAutoLink(url: string): boolean {
  // ... logic
}
```

### Step 4: Verify No Regressions

Run all link-related tests:
```bash
bun run test -- --testPathPattern="link|paste" --verbose
```

## Files to Modify

| File | Change |
|------|--------|
| `src/webview/editor.ts` | Add `shouldAutoLink` to `Link.configure()` |
| `src/__tests__/webview/linkAutolink.test.ts` | New test file for autolink behavior |

## Acceptance Criteria

- [ ] `.MD`, `.md`, `.txt`, `.pdf` stay as plain text (not linked)
- [ ] `https://example.com` gets auto-linked
- [ ] `[text](url)` markdown syntax creates links
- [ ] Existing link tests pass
- [ ] No regressions in paste handler link behavior

## Related TipTap Docs

- [Link extension shouldAutoLink](https://tiptap.dev/docs/editor/extensions/marks/link#shouldautolink)
- [Link extension isAllowedUri](https://tiptap.dev/docs/editor/extensions/marks/link#isalloweduri)
