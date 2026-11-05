/**
 * Local preview, never shipped: mounts the panel against the Host half running
 * inside the Vite dev server (see `vite.config.ts`), so the page shows real
 * sessions without packing or installing the plugin.
 *
 * @module @cyrusdoyle/dsh-sessions-insight/preview
 */

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { fillParams, setRuntimeTranslate, zh } from "../../plugins/sessions-insight/src/client/locale.ts"
import { injectStyles } from "../../plugins/sessions-insight/src/client/styles.ts"
import { ContextInsightPanel } from "../../plugins/sessions-insight/src/client/ui/panel.tsx"
import { reportProbe } from "./probe.ts"
import { createPreviewSettings } from "./settings.ts"
import { stageShot } from "./shot.ts"

// The preview asks the dictionary directly (there is no locale service here),
// and only for the keys it renders, so the key is narrowed to the dictionary's.
setRuntimeTranslate((key, params) => fillParams(zh[key as keyof typeof zh], params))
injectStyles()

const query = new URLSearchParams(location.search)
const { store: settingsStore } = createPreviewSettings()
const root = document.getElementById("root")
if (root === null) throw new Error("preview root missing")
createRoot(root).render(
  <StrictMode>
    <div style={{ blockSize: "100vh", inlineSize: "100vw", overflow: "hidden" }}>
      <ContextInsightPanel
        settingsStore={settingsStore}
        initialPage={query.get("page") === "settings" ? "settings" : "sessions"}
      />
    </div>
  </StrictMode>,
)

if (query.get("probe") === "1") reportProbe()
const scene = query.get("shot")
if (scene !== null) stageShot(scene)
