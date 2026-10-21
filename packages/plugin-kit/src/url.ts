/**
 * How a plugin route is spelled on the wire.
 *
 * The page carries `<base href="./">` and routes are mounted at the site root,
 * so every request path exists in two spellings: the absolute one the Host
 * registers and the document-relative one the browser fetches. Keeping the
 * conversion here means a plugin defines its paths once and derives the other
 * spelling rather than hand-writing both.
 *
 * @module @cyrus/dsh-plugin-kit/url
 */

/**
 * The document-relative spelling of a mount-absolute path.
 * @param path - an absolute route path.
 * @returns the same route without its leading slashes.
 */
export function browserUrl(path: string): string {
  return path.replace(/^\/+/, "")
}

/**
 * Join a caller-supplied base to a route.
 *
 * `base` is empty for document-relative requests and a prefix ("/x") when the
 * same panel is served from a sub-path.
 * @param base - prefix prepended to every route.
 * @param path - the route, absolute or document-relative.
 * @returns the path to fetch.
 */
export function mountUrl(base: string, path: string): string {
  return base + browserUrl(path)
}
