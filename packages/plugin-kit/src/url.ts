/**
 * How a plugin route is spelled on the wire.
 *
 * The page carries `<base href="./">` and routes are mounted at the site root,
 * so every request path exists in two spellings: the absolute one the Host
 * registers and the document-relative one the browser fetches. Keeping the
 * conversion here means a plugin defines its paths once and derives the other
 * spelling rather than hand-writing both.
 *
 * @module @cyrusdoyle/dsh-plugin-kit/url
 */

/**
 * The document-relative spelling of a mount-absolute path.
 * @param path - an absolute route path.
 * @returns the same route without its leading slashes.
 */
export function browserUrl(path: string): string {
  return path.replace(/^\/+/, "")
}
