import type { Turn } from "@cyrusdoyle/dsh-session-contract"

/** Adapter extension: identity only, never the injected skill body. */
export interface SkillInjection {
  readonly name: string
  readonly path: string
}

export type SkillInjectionTurn = Turn & { readonly skillInjections?: readonly SkillInjection[] }

/** Only a loaded <skill> block, not a catalog or an instruction mentioning a skill. */
export function skillInjectionsOf(text: string): SkillInjection[] {
  const identities = new Map<string, SkillInjection>()
  for (const match of text.matchAll(
    /<skill>\s*<name>([^<>\r\n]+)<\/name>\s*<path>([^<>\r\n]+)<\/path>[\s\S]*?<\/skill>/g,
  )) {
    const name = match[1]!.trim()
    const path = match[2]!.trim()
    if (name === "" || !path.replaceAll("\\", "/").endsWith("/SKILL.md") || /\0/.test(path)) continue
    identities.set(path, { name, path })
  }
  return [...identities.values()]
}
