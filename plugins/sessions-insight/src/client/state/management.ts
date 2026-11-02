import type { AiTitleValue } from "../../protocol/ai-title.ts"
import type { MetadataPatch, MetadataValue, SessionMetadataValue } from "../../protocol/management.ts"
import { type Api, type ApiResult, failureText } from "../api.ts"
import { sessionKey, type TreeSession } from "./tree.ts"

/** Structurally matches the API being connected by the panel owner. */
export type ManagementApi = Pick<Api, "deleteSession"> & {
  metadata(signal?: AbortSignal): Promise<ApiResult<MetadataValue>>
  updateMetadata(patch: MetadataPatch): Promise<ApiResult<SessionMetadataValue>>
  suggestTitle(source: string, id: string, signal?: AbortSignal): Promise<ApiResult<AiTitleValue>>
}

export interface ManagementFailure {
  session: TreeSession
  reason: string
}

/** Serial writes: successful rows are published immediately, failures do not stop the batch. */
export async function runSessionBatch<T>(
  sessions: readonly TreeSession[],
  write: (session: TreeSession) => Promise<ApiResult<T>>,
  onSuccess: (session: TreeSession, value: T) => void,
  signal?: AbortSignal,
): Promise<ManagementFailure[]> {
  const failures: ManagementFailure[] = []
  for (const session of sessions) {
    // Stop only between writes: an already sent mutation must publish its real result.
    if (signal?.aborted) break
    try {
      const result = await write(session)
      if (result.ok) onSuccess(session, result.value)
      else failures.push({ session, reason: failureText(result) })
    } catch (error) {
      failures.push({ session, reason: error instanceof Error ? error.message : String(error) })
    }
  }
  return failures
}

export function applySessionMetadata(
  sessions: ReadonlyMap<string, readonly TreeSession[]>,
  metadata: ReadonlyMap<string, SessionMetadataValue>,
  groupFilter: string,
): Map<string, TreeSession[]> {
  return new Map(
    [...sessions].map(([workdir, list]) => [
      workdir,
      list.flatMap((session) => {
        const value = metadata.get(sessionKey(session.source, session.id))
        const group = value?.metadata.group ?? ""
        if (groupFilter !== "" && (groupFilter === "ungrouped" ? group !== "" : group !== groupFilter.slice(6)))
          return []
        const title = value?.displayTitle ?? value?.metadata.title ?? session.title
        const hasAlias = (value?.metadata.title?.trim().length ?? 0) > 0
        return [
          hasAlias ? { ...session, title, named: true } : title === session.title ? session : { ...session, title },
        ]
      }),
    ]),
  )
}
