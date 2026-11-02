import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"

import type { ContextSource } from "../../protocol.ts"
import type { MetadataPatch, MetadataValue, SessionMetadata } from "../../protocol/management.ts"
import { isMetadataPatch, isMetadataValue } from "../../protocol/management.ts"

export interface MetadataStore {
  read(): Promise<MetadataValue>
  patch(patch: MetadataPatch): Promise<SessionMetadata>
  remove(source: ContextSource, id: string): Promise<void>
}

export function metadataPathFrom(env: NodeJS.ProcessEnv = process.env): string {
  const home = env["DSH_HOME"]
  return join(
    home !== undefined && home.trim() !== "" ? home : join(homedir(), ".dsh"),
    "dsh-sessions-insight",
    "metadata.json",
  )
}

// Reloaded Host fibers targeting the same file must not lose each other's writes.
const queues = new Map<string, Promise<unknown>>()

export class SessionMetadataStore implements MetadataStore {
  readonly path: string

  constructor(path = metadataPathFrom()) {
    this.path = resolve(path)
  }

  #serial<T>(run: () => Promise<T>): Promise<T> {
    const pending = (queues.get(this.path) ?? Promise.resolve()).catch(() => undefined).then(run)
    queues.set(this.path, pending)
    void pending
      .finally(() => {
        if (queues.get(this.path) === pending) queues.delete(this.path)
      })
      .catch(() => undefined)
    return pending
  }

  async #read(): Promise<MetadataValue> {
    let text: string
    try {
      text = await readFile(this.path, "utf8")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { entries: [] }
      throw error
    }
    const value: unknown = JSON.parse(text)
    if (!isMetadataValue(value)) throw new Error("invalid-session-metadata-store")
    return value
  }

  async #write(value: MetadataValue): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true })
    const temporary = `${this.path}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, `${JSON.stringify(value)}\n`, { flag: "wx", mode: 0o600 })
      await rename(temporary, this.path)
    } finally {
      await rm(temporary, { force: true })
    }
  }

  read(): Promise<MetadataValue> {
    return this.#serial(() => this.#read())
  }

  patch(patch: MetadataPatch): Promise<SessionMetadata> {
    if (!isMetadataPatch(patch)) return Promise.reject(new Error("invalid-metadata-patch"))
    return this.#serial(async () => {
      const value = await this.#read()
      const index = value.entries.findIndex((entry) => entry.source === patch.source && entry.id === patch.id)
      const metadata: SessionMetadata = { ...(value.entries[index] ?? { source: patch.source, id: patch.id }) }
      for (const field of ["title", "group"] as const) {
        const text = patch[field]
        if (text === null) delete metadata[field]
        else if (text !== undefined) metadata[field] = text.trim()
      }
      if (index >= 0) value.entries.splice(index, 1)
      if (metadata.title !== undefined || metadata.group !== undefined) value.entries.push(metadata)
      await this.#write(value)
      return metadata
    })
  }

  remove(source: ContextSource, id: string): Promise<void> {
    return this.#serial(async () => {
      const value = await this.#read()
      const entries = value.entries.filter((entry) => entry.source !== source || entry.id !== id)
      if (entries.length !== value.entries.length) await this.#write({ entries })
    })
  }
}
