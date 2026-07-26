/**
 * Export smoke test
 * -----------------
 * Renders every starter template to TSX and writes the results into
 * `src/__exporttest__/`, where the project's own `tsc` run type-checks them
 * against the real SDK types. A builder that emits code which does not compile
 * is worse than no builder, so this is wired into `npm run verify`.
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs"
import { createServer } from "vite"

const OUT = new URL("../src/__exporttest__/", import.meta.url).pathname

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" })
try {
  const { STARTER_TEMPLATES } = await server.ssrLoadModule("/src/state/templates.ts")
  const { exportToTsx } = await server.ssrLoadModule("/src/state/export.ts")

  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })

  for (const template of STARTER_TEMPLATES) {
    const name = template.name.replace(/[^A-Za-z0-9]/g, "")
    const code = exportToTsx(template.build(), { componentName: name })
    writeFileSync(`${OUT}${name}.tsx`, code)
    console.log("\n" + "=".repeat(64) + `\n${template.name}\n` + "=".repeat(64))
    console.log(code)
  }
} finally {
  await server.close()
}
