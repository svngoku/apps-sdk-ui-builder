/**
 * README screenshot capture
 * -------------------------
 * Loads the single-file build in headless Chromium and captures the builder in
 * a representative state. Run after `npm run build:singlefile`.
 *
 * Local rather than via a published URL: CDN caching made remote captures
 * unreliable, and a local file is always the build that was just produced.
 */
import { chromium } from "playwright"
import { resolve } from "node:path"

const file = "file://" + resolve("dist-singlefile/index.html")
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })

const errors: string[] = []
page.on("pageerror", (e) => errors.push(e.message))

await page.goto(file, { waitUntil: "load" })
await page.waitForSelector("[data-canvas-surface]", { timeout: 15000 })

// Load a template so the shot shows real composed UI, not an empty canvas.
await page.selectOption('select[aria-label="Load a starter template"]', "Reservation card")
await page.waitForTimeout(600)

// Select a node so the inspector is populated rather than showing its empty state.
const badge = page.locator('[data-node-id]', { hasText: "Confirmed" }).last()
if (await badge.count()) {
  await badge.click({ force: true })
  await page.waitForTimeout(400)
}

await page.screenshot({ path: "docs/screenshot.png" })

// Dark variant, to prove the theme toggle reaches the previewed components.
await page.click('button[aria-pressed="false"]:has-text("Dark")')
await page.waitForTimeout(500)
await page.screenshot({ path: "docs/screenshot-dark.png" })
const darkTheme = await page.getAttribute("[data-canvas-surface]", "data-theme")
console.log("after toggle  :", darkTheme)
await page.click('button[aria-pressed="true"]:has-text("Dark")')
await page.waitForTimeout(300)

// Report measured layout so regressions are caught numerically, not by eye.
const widths = await page.$$eval("header select", (els) =>
  els.map((el) => ({ label: el.getAttribute("aria-label"), width: Math.round(el.getBoundingClientRect().width) })),
)
console.log("toolbar selects:", JSON.stringify(widths))
console.log("canvas theme   :", await page.getAttribute("[data-canvas-surface]", "data-theme"))
console.log("page errors    :", errors.length ? errors : "none")

await browser.close()
