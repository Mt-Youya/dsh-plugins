import type { ContextSource } from "../types.ts"
import { isSafeId } from "./ids.ts"
import { isRecord } from "./shared.ts"
import { isContextSource } from "./sources.ts"

export interface DeleteSessionValue {
  source: ContextSource
  id: string
}

export function isDeleteSessionValue(value: unknown): value is DeleteSessionValue {
  return isRecord(value) && isContextSource(value["source"]) && typeof value["id"] === "string" && isSafeId(value["id"])
}
