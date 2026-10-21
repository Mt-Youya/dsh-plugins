# Domain Docs

How the engineering skills should consume this repo's domain documentation before exploring code.

## Before exploring, read these

- GLOSSARY.md at the repo root: the project's canonical vocabulary (上下文、轮次、会话、来源、工具类、组件类、界面文件、本地预览).
- docs/adr/: read the ADRs that touch the area you are about to work in. 0002 fixes the asar 0.2.1 contract, 0003 forbids hand-written session appends, 0005 defines the asymmetric reconcile policy, 0008 defines the styling system.

If any of these files do not exist, proceed silently: do not flag their absence and do not suggest creating them upfront. The domain-modeling skill creates them lazily when a term or a decision is actually resolved.

## Layout

Single-context repo: one GLOSSARY.md and one docs/adr/ at the root. There is no GLOSSARY-MAP.md and no per-package GLOSSARY.md; if a second context ever appears, add GLOSSARY-MAP.md then, not before.
