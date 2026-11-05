import { isRecord, isPluginName, type PluginName, type VersionValue } from "../../protocol/utilities.ts"
import { PLUGIN_NAME } from "../../version.ts"
import { requestUtilityJson, type UtilityRequest } from "./https.ts"
import { compareVersions } from "./semver.ts"

export const VERSION_TTL_MS = 60 * 60 * 1000
/** A failure retries in five minutes, so a transient registry error does not pin the panel for an hour. */
export const VERSION_FAILED_TTL_MS = 5 * 60 * 1000
export class VersionChecker {
  private cached: VersionValue | undefined
  private inflight: Promise<VersionValue> | undefined
  constructor(
    private currentVersion: string,
    private request: UtilityRequest = requestUtilityJson,
    private packageName: PluginName = PLUGIN_NAME,
  ) {}
  peek(): VersionValue {
    return (
      this.cached ?? {
        status: "unchecked",
        packageName: this.packageName,
        currentVersion: this.currentVersion,
        checkedAt: null,
      }
    )
  }
  check(force = false): Promise<VersionValue> {
    if (this.inflight !== undefined) return this.inflight
    const cached = this.cached
    if (!force && cached !== undefined && cached.checkedAt !== null) {
      const age = Date.now() - cached.checkedAt
      // A negative age means the clock moved backwards; treat that as stale.
      const ttl = cached.status === "failed" ? VERSION_FAILED_TTL_MS : VERSION_TTL_MS
      if (age >= 0 && age < ttl) return Promise.resolve(cached)
    }
    const pending = this.load().then((value) => {
      this.cached = value
      return value
    })
    this.inflight = pending
    void pending.finally(() => {
      if (this.inflight === pending) this.inflight = undefined
    })
    return pending
  }
  private async load(): Promise<VersionValue> {
    const currentVersion = this.currentVersion
    try {
      if (!isPluginName(this.packageName)) throw new Error("invalid-package")
      const response = await this.request(this.packageName)
      if (isRecord(response) && response.name !== undefined && response.name !== this.packageName)
        throw new Error("package-mismatch")
      if (!isRecord(response) || typeof response.version !== "string") throw new Error("invalid-version")
      const order = compareVersions(response.version, currentVersion)
      if (order === undefined) throw new Error("invalid-version")
      return {
        status: order > 0 ? "update" : "current",
        packageName: this.packageName,
        currentVersion,
        latestVersion: response.version,
        checkedAt: Date.now(),
      }
    } catch {
      return { status: "failed", packageName: this.packageName, currentVersion, checkedAt: Date.now() }
    }
  }
}
