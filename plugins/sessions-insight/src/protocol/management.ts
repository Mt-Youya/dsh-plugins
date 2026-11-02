import type { ContextSource } from "../protocol.ts"
import { isDeleteSessionValue } from "../protocol.ts"
import { API_ROOT, browserUrl } from "./paths.ts"

export const SESSION_METADATA_PATH = `${API_ROOT}/session/metadata`
export const SESSION_METADATA_URL = browserUrl(SESSION_METADATA_PATH)
export const METADATA_TEXT_LIMIT = 80

export interface SessionMetadata {
  source: ContextSource
  id: string
  title?: string
  group?: string
}

export interface MetadataPatch {
  source: ContextSource
  id: string
  title?: string | null
  group?: string | null
}

export interface MetadataValue {
  entries: SessionMetadata[]
}

export interface SessionMetadataValue {
  metadata: SessionMetadata
  displayTitle?: string
}

function hasShape(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => keys.includes(key))
  )
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= METADATA_TEXT_LIMIT
}

function isReference(value: Record<string, unknown>): boolean {
  return isDeleteSessionValue(value)
}

export function isSessionMetadata(value: unknown): value is SessionMetadata {
  return (
    hasShape(value, ["source", "id", "title", "group"]) &&
    isReference(value) &&
    (!("title" in value) || isText(value["title"])) &&
    (!("group" in value) || isText(value["group"]))
  )
}

export function isMetadataPatch(value: unknown): value is MetadataPatch {
  return (
    hasShape(value, ["source", "id", "title", "group"]) &&
    isReference(value) &&
    ("title" in value || "group" in value) &&
    (!("title" in value) || value["title"] === null || isText(value["title"])) &&
    (!("group" in value) || value["group"] === null || isText(value["group"]))
  )
}

export function isMetadataValue(value: unknown): value is MetadataValue {
  if (!hasShape(value, ["entries"]) || !Array.isArray(value["entries"])) return false
  const keys = new Set<string>()
  for (const entry of value["entries"]) {
    if (!isSessionMetadata(entry)) return false
    const key = `${entry.source}:${entry.id}`
    if (keys.has(key)) return false
    keys.add(key)
  }
  return true
}

export function isSessionMetadataValue(value: unknown): value is SessionMetadataValue {
  return (
    hasShape(value, ["metadata", "displayTitle"]) &&
    isSessionMetadata(value["metadata"]) &&
    (!("displayTitle" in value) || typeof value["displayTitle"] === "string")
  )
}
