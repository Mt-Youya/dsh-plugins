/** Strict SemVer precedence, including prerelease identifiers; build metadata is ignored. */
function parse(version: string): { core: string[]; pre: string[] } | undefined {
  if (version.length > 128) return undefined
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/.exec(
      version,
    )
  if (match === null || match[0] !== version) return undefined
  const pre = match[4]?.split(".") ?? []
  if (pre.some((id) => /^\d+$/.test(id) && id.length > 1 && id.startsWith("0"))) return undefined
  return { core: [match[1]!, match[2]!, match[3]!], pre }
}
function numeric(a: string, b: string): number {
  return a.length === b.length ? (a === b ? 0 : a < b ? -1 : 1) : a.length < b.length ? -1 : 1
}
export function compareVersions(a: string, b: string): number | undefined {
  const left = parse(a),
    right = parse(b)
  if (left === undefined || right === undefined) return undefined
  for (let i = 0; i < 3; i++) {
    const order = numeric(left.core[i]!, right.core[i]!)
    if (order !== 0) return order
  }
  if (left.pre.length === 0 || right.pre.length === 0)
    return left.pre.length === right.pre.length ? 0 : left.pre.length === 0 ? 1 : -1
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i++) {
    const x = left.pre[i],
      y = right.pre[i]
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1
    if (x === y) continue
    const xn = /^\d+$/.test(x),
      yn = /^\d+$/.test(y)
    if (xn && yn) return numeric(x, y)
    if (xn !== yn) return xn ? -1 : 1
    return x < y ? -1 : 1
  }
  return 0
}
