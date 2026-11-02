import type { ContextSource } from "../protocol.ts"
import { isDeleteSessionValue } from "../protocol.ts"
import { METADATA_TEXT_LIMIT } from "./management.ts"
import { API_ROOT, browserUrl } from "./paths.ts"

export const SESSION_AI_TITLE_PATH = `${API_ROOT}/session/title/suggest`
export const SESSION_AI_TITLE_URL = browserUrl(SESSION_AI_TITLE_PATH)

export interface AiTitleRequest {
  source: ContextSource
  id: string
}

export interface AiTitleValue extends AiTitleRequest {
  title: string
  provider: string
  model: string
}

function hasShape(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => keys.includes(key))
  )
}

export function isAiTitleRequest(value: unknown): value is AiTitleRequest {
  return hasShape(value, ["source", "id"]) && isDeleteSessionValue(value)
}

export function isAiTitleValue(value: unknown): value is AiTitleValue {
  return (
    hasShape(value, ["source", "id", "title", "provider", "model"]) &&
    isDeleteSessionValue(value) &&
    typeof value["title"] === "string" &&
    value["title"].trim() === value["title"] &&
    value["title"].length > 0 &&
    value["title"].length <= METADATA_TEXT_LIMIT &&
    !/[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060-\u2069\ufeff]/u.test(value["title"]) &&
    typeof value["provider"] === "string" &&
    value["provider"].trim().length > 0 &&
    typeof value["model"] === "string" &&
    value["model"].trim().length > 0
  )
}
