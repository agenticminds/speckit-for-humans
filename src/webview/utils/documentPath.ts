/**
 * The path of the document this webview is showing.
 *
 * The webview is sandboxed: its content security policy is `default-src 'none'`
 * and it has no file system access, so it cannot discover its own path. The
 * extension host sends it in every `update` message (contract C-msg-1) and this
 * module holds it.
 *
 * Feature-folder resolution for spec-kit ID links depends on this. Without a
 * path there is no way to know which feature a document belongs to, which is
 * what FR-015, FR-018 and FR-019 are all defined in terms of.
 *
 * Kept in its own module rather than in the editor entry point so that a
 * ProseMirror plugin can read it without importing the entry point and creating
 * a cycle.
 */

let documentPath: string | null = null;

/**
 * Record the path sent by the host.
 *
 * Null is meaningful and must be stored as null: it says the document has no
 * path on disk — untitled, or a virtual scheme — and therefore belongs to no
 * feature folder, so nothing in it may be linked (FR-019). Treating null as
 * "unknown, try anyway" would link tokens in documents that must stay plain.
 */
export function setDocumentPath(value: unknown): void {
  documentPath = typeof value === 'string' && value.length > 0 ? value : null;
}

/** The stored path, or null when the document has none. */
export function getDocumentPath(): string | null {
  return documentPath;
}

/** Test helper. Clears the stored path so suites do not leak into each other. */
export function resetDocumentPath(): void {
  documentPath = null;
}
