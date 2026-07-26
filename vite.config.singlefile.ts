/**
 * Single-file build.
 *
 * Inlines the entire builder — JS, CSS, and the generated registry — into one
 * self-contained `index.html`, so it can be shared or opened directly from disk
 * with no server. Used for demos; `npm run build` remains the normal path.
 */
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    outDir: "dist-singlefile",
    // Everything must live in one document, so chunking is disabled.
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
})
