/**
 * Where each harness family keeps its sessions, per platform.
 *
 * Every root is a directory the reader is then confined to; an environment
 * variable overrides exactly one family so tests and relocated installs do not
 * have to fake a whole profile. Nothing here probes the disk — the corpora do
 * that and answer `missing` when the app was never installed.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/host/harness/roots
 */

import { homedir } from "node:os"
import { join } from "node:path"

/** Override the Cursor `User` directory. */
export const CURSOR_USER_ENV = "DSH_CONTEXT_INSIGHT_CURSOR_USER"
/** Override the pi sessions root. */
export const PI_SESSIONS_ENV = "DSH_CONTEXT_INSIGHT_PI_SESSIONS"
/** Override one VS Code-family `User` directory. */
export const VSCODE_USER_ENV = "DSH_CONTEXT_INSIGHT_VSCODE_USER"
/** Override the Cline tasks root. */
export const CLINE_TASKS_ENV = "DSH_CONTEXT_INSIGHT_CLINE_TASKS"
/** Override the Roo Code tasks root. */
export const ROO_TASKS_ENV = "DSH_CONTEXT_INSIGHT_ROO_TASKS"
/** Override the Antigravity data root. */
export const ANTIGRAVITY_ROOT_ENV = "DSH_CONTEXT_INSIGHT_ANTIGRAVITY"

/** User directories of the VS Code builds whose chat store this reader knows. */
const VSCODE_APPS = ["Code", "Code - Insiders", "VSCodium", "Code - OSS"] as const

/** VS Code forks that may keep the same `chatSessions` layout. */
const VSCODE_FORKS = ["Kiro", "Trae", "Qoder"] as const

/** VS Code-derived apps whose extension storage Cline/Roo may live in. */
const CLINE_HOST_APPS = ["Code", "Code - Insiders", "VSCodium", "Cursor"] as const

/** Extension ids as they appear on disk; macOS keeps the case and Linux does not. */
const CLINE_EXT = "saoudrizwan.claude-dev"
const ROO_EXT = "rooveterinaryinc.roo-cline"

/** One app's task directory, with the app name kept for the row tooltip. */
export interface TaskRoot {
  app: string
  dir: string
}

/** Everything the harness sources read from. */
export interface HarnessRoots {
  /** `<appData>/Cursor/User` (globalStorage holds the chat database). */
  cursorUser: string
  /** `~/.pi/agent/sessions`. */
  piSessions: string
  /** `<appData>/<app>/User`, one per VS Code build or fork. */
  vscodeUsers: { app: string; user: string }[]
  /** `<appData>/<app>/User/globalStorage/<ext>/tasks`. */
  taskRoots: TaskRoot[]
  /** `~/.gemini/antigravity*` data directories. */
  antigravity: string[]
}

/** Platform application-data root. */
export function appDataRoot(env: NodeJS.ProcessEnv, platform: NodeJS.Platform = process.platform): string {
  if (platform === "darwin") return join(homedir(), "Library", "Application Support")
  if (platform === "win32") {
    const roaming = env["APPDATA"]
    return roaming !== undefined && roaming.trim() !== "" ? roaming : join(homedir(), "AppData", "Roaming")
  }
  const config = env["XDG_CONFIG_HOME"]
  return config !== undefined && config.trim() !== "" ? config : join(homedir(), ".config")
}

/** Read a one-value override; blank means unset. */
function override(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]
  return value !== undefined && value.trim() !== "" ? value : undefined
}

/**
 * Resolve every harness root for one environment.
 * @param env - process environment (tests relocate roots through it).
 * @param platform - platform to build defaults for.
 * @returns the roots, with overrides replacing the default of their family only.
 */
export function harnessRootsFrom(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): HarnessRoots {
  const appData = appDataRoot(env, platform)
  const cursorOverride = override(env, CURSOR_USER_ENV)
  const piOverride = override(env, PI_SESSIONS_ENV)
  const vscodeOverride = override(env, VSCODE_USER_ENV)
  const clineOverride = override(env, CLINE_TASKS_ENV)
  const rooOverride = override(env, ROO_TASKS_ENV)
  const antigravityOverride = override(env, ANTIGRAVITY_ROOT_ENV)
  const piHome = env["PI_CODING_AGENT_DIR"]
  const piSessions =
    piOverride ??
    (piHome !== undefined && piHome.trim() !== ""
      ? join(piHome, "sessions")
      : join(homedir(), ".pi", "agent", "sessions"))
  const vscodeUsers = (
    vscodeOverride === undefined
      ? [...VSCODE_APPS, ...VSCODE_FORKS].map((app) => ({ app, user: join(appData, app, "User") }))
      : [{ app: "VS Code", user: vscodeOverride }]
  ).filter((entry) => entry.app !== "Code - OSS" || platform !== "darwin")
  const taskRoots: TaskRoot[] = []
  for (const app of CLINE_HOST_APPS) {
    const user = join(appData, app, "User", "globalStorage")
    taskRoots.push(
      { app: `${app} · Cline`, dir: join(user, CLINE_EXT, "tasks") },
      { app: `${app} · Roo Code`, dir: join(user, ROO_EXT, "tasks") },
    )
  }
  if (clineOverride !== undefined) taskRoots.unshift({ app: "Cline", dir: clineOverride })
  if (rooOverride !== undefined) taskRoots.unshift({ app: "Roo Code", dir: rooOverride })
  const antigravityDirs =
    antigravityOverride === undefined
      ? ["antigravity", "antigravity-ide", "antigravity-cli"].map((name) => join(homedir(), ".gemini", name))
      : [antigravityOverride]
  return {
    cursorUser: cursorOverride ?? join(appData, "Cursor", "User"),
    piSessions,
    vscodeUsers,
    taskRoots,
    antigravity: antigravityDirs,
  }
}
