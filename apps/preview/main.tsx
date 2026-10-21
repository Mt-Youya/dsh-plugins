/**
 * Local preview, never shipped: mounts the panel against the Host half running
 * inside the Vite dev server (see `vite.config.ts`), so the page shows real
 * sessions without packing or installing the plugin.
 *
 * @module @cyrus/dsh-context-insight/preview
 */

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { fillParams, setRuntimeTranslate, zh } from "../../plugins/context-insight/src/client/locale.ts"
import { injectStyles } from "../../plugins/context-insight/src/client/styles.ts"
import { ContextInsightPanel } from "../../plugins/context-insight/src/client/ui/panel.tsx"
import { reportProbe } from "./probe.ts"

// The preview asks the dictionary directly (there is no locale service here),
// and only for the keys it renders, so the key is narrowed to the dictionary's.
setRuntimeTranslate((key, params) => fillParams(zh[key as keyof typeof zh], params))
injectStyles()

const root = document.getElementById("root")
if (root === null) throw new Error("preview root missing")
createRoot(root).render(
  <StrictMode>
    <div style={{ blockSize: "100vh", inlineSize: "100vw", overflow: "hidden" }}>
      <ContextInsightPanel />
    </div>
  </StrictMode>
)

if (new URLSearchParams(location.search).get("probe") === "1") reportProbe()
