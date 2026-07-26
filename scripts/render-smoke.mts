/**
 * Render smoke test
 * -----------------
 * Type-checking proves the exported code compiles; it does not prove the canvas
 * mounts. This mounts every palette component *and* every starter template into
 * a real DOM and fails on any thrown error — catching Radix composition
 * violations, missing required handlers, and bad prop shapes that only surface
 * at runtime.
 *
 * A DOM (happy-dom) rather than `renderToStaticMarkup` is required: several SDK
 * components measure layout via `getComputedStyle` / `ResizeObserver` during
 * mount, which do not exist in bare Node.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { createServer } from "vite"

// Order matters: happy-dom's registrator replaces globals including
// `setTimeout`, and Vite's dep optimiser calls `setTimeout(...).unref()`, which
// the browser implementation does not provide. Start Vite first, register the
// DOM second.
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
  resolve: { conditions: ["browser"] },
  ssr: { noExternal: ["@openai/apps-sdk-ui"] },
})

const nodeSetTimeout = globalThis.setTimeout
GlobalRegistrator.register()
// Restore Node's timer so Vite internals keep working post-registration.
globalThis.setTimeout = nodeSetTimeout

// `ResizeObserver` is not implemented by happy-dom but is used by components
// that auto-size. A minimal stub is enough for a mount check.
if (!("ResizeObserver" in globalThis)) {
  // @ts-expect-error -- test shim
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const { createElement, StrictMode, act } = await import("react")
const { createRoot } = await import("react-dom/client")

// React marks test-only act() usage via this global.
// @ts-expect-error -- test shim
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let failures = 0
const failureDetail: string[] = []

function record(ok: boolean, label: string, detail: string) {
  if (!ok) {
    failures += 1
    failureDetail.push(`${label}: ${detail}`)
  }
  console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(28)} ${detail}`)
}

try {
  const { renderNode } = await server.ssrLoadModule("/src/builder/NodeRenderer.tsx")
  const registry = await server.ssrLoadModule("/src/registry/index.ts")
  const { STARTER_TEMPLATES } = await server.ssrLoadModule("/src/state/templates.ts")
  const { AppsSDKUIProvider } = await server.ssrLoadModule(
    "@openai/apps-sdk-ui/components/AppsSDKUIProvider",
  )

  const ctx = {
    selectedId: null,
    hoveredId: null,
    dropTargetId: null,
    draggingId: null,
    interactive: false,
    onSelect() {},
    onHover() {},
    onDropInto() {},
    onDragStartNode() {},
  }

  /** Mount a node tree and return the rendered HTML length. */
  async function mount(nodes: unknown[]): Promise<number> {
    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(
            AppsSDKUIProvider,
            { linkComponent: "a" },
            nodes.map((node) => renderNode({ node, ctx })),
          ),
        ),
      )
    })

    const size = host.innerHTML.length
    await act(async () => root.unmount())
    host.remove()
    return size
  }

  /* ------------------------- Every palette entry ------------------------- */

  console.log("\n--- palette components ---")
  const paletteNames = registry
    .getPaletteGroups()
    .flatMap((group: { entries: { name: string }[] }) => group.entries.map((e) => e.name))

  for (const name of paletteNames) {
    try {
      const node = registry.createNode(name)
      const size = await mount([node])
      record(true, name, `${size}b`)
    } catch (error) {
      record(false, name, (error as Error).message.split("\n")[0])
    }
  }

  /* --------------------------- Templates --------------------------------- */

  console.log("\n--- starter templates ---")
  for (const template of STARTER_TEMPLATES) {
    try {
      const size = await mount(template.build().root)
      // A template rendering to almost nothing indicates a silent failure.
      record(size > 80, template.name, `${size}b`)
    } catch (error) {
      record(false, template.name, (error as Error).message.split("\n")[0])
    }
  }
} finally {
  await server.close()
}

console.log(
  failures === 0
    ? "\nAll components and templates mounted cleanly."
    : `\n${failures} failure(s):\n` + failureDetail.map((f) => `  - ${f}`).join("\n"),
)

process.exit(failures === 0 ? 0 : 1)
