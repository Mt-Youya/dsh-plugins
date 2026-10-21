/**
 * Linking a DSH session to the children it spawned.
 *
 * A subagent runs as its *own* session with its own log file; the parent only
 * records a catalog entry naming the child's id. The IR requires those children
 * to stay out of the parent's turns and appear only as `Turn.subagents`, so
 * this module owns the association and nothing else.
 *
 * Team members are folded into the same link list: from the parent's point of
 * view a teammate is a child session too, and the panel shows them in one tree.
 */

import { objectField, stringField, type JsonObject } from "./records.ts"

/** One child session a parent knows about. */
export interface SubagentLink {
  /** Child session id, which is also its log directory name. */
  id: string
  /** Human label, when the harness recorded one. */
  label?: string
  /** `one-shot` or `continuable`; team members report their own phase instead. */
  mode?: string
  provider?: string
  model?: string
}

/** Collects child links from the three event types that can name one. */
export class SubagentTracker {
  private readonly byId = new Map<string, SubagentLink>()

  private link(id: string): SubagentLink {
    const existing = this.byId.get(id)
    if (existing !== undefined) return existing
    const created: SubagentLink = { id }
    this.byId.set(id, created)
    return created
  }

  /**
   * Read one event, recording any child it names.
   * @param type - the event type.
   * @param data - the event's `data`.
   * @returns the child id this event named, so the caller can attach it to the
   *   currently open turn.
   */
  observe(type: string, data: JsonObject): string | undefined {
    if (type === "subagent/catalog") {
      const id = stringField(data, "childId")
      if (id === undefined) return undefined
      const link = this.link(id)
      const label = stringField(data, "label")
      const mode = stringField(data, "mode")
      if (label !== undefined) link.label = label
      if (mode !== undefined) link.mode = mode
      return id
    }
    if (type === "subagent/descriptor") {
      // A descriptor describes the child the next catalog entry will name, and
      // carries no id of its own; its model facts are kept on the last child.
      const last = [...this.byId.values()].at(-1)
      if (last === undefined) return undefined
      const provider = stringField(data, "agentProvider")
      const model = stringField(data, "agentModel")
      const label = stringField(data, "label")
      const mode = stringField(data, "mode")
      if (provider !== undefined) last.provider = provider
      if (model !== undefined) last.model = model
      if (label !== undefined && last.label === undefined) last.label = label
      if (mode !== undefined && last.mode === undefined) last.mode = mode
      return last.id
    }
    if (type === "team/member") {
      const member = objectField(data, "member")
      const id = stringField(member, "id")
      if (id === undefined) return undefined
      const link = this.link(id)
      const name = stringField(member, "name")
      const provider = stringField(member, "provider")
      if (name !== undefined) link.label = name
      if (provider !== undefined) link.provider = provider
      const phase = stringField(member, "phase")
      link.mode = phase === undefined ? "team" : `team:${phase}`
      return id
    }
    return undefined
  }

  /** Every child seen, in first-seen order. */
  all(): SubagentLink[] {
    return [...this.byId.values()]
  }

  /** How many distinct children were linked. */
  get size(): number {
    return this.byId.size
  }
}
