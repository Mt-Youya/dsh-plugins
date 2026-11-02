import type { ContextSource, SessionsValue } from "../../protocol.ts"
import type { MetadataValue } from "../../protocol/management.ts"
import type { MetadataStore } from "./store.ts"

export function metadataTitle(value: MetadataValue, source: ContextSource, id: string): string | undefined {
  return value.entries.find((entry) => entry.source === source && entry.id === id)?.title
}

export async function projectSessions(value: SessionsValue, store?: MetadataStore): Promise<SessionsValue> {
  if (store === undefined) return value
  const metadata = await store.read()
  const titles = new Map(metadata.entries.map((entry) => [`${entry.source}:${entry.id}`, entry.title]))
  return {
    ...value,
    sessions: value.sessions.map((session) => {
      const title = titles.get(`${session.source}:${session.id}`)
      return title === undefined ? session : { ...session, title }
    }),
  }
}
