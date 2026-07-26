/**
 * Code panel
 * ----------
 * Shows the exported TSX for the current document and offers copy / download.
 * Rendered live so the user can see the effect of every edit on real output —
 * the exported code is the actual deliverable of this tool.
 */

import { useMemo, useState } from "react"

import type { UIDocument } from "../state/document"
import { exportStats, exportToTsx } from "../state/export"

type CodePanelProps = {
  doc: UIDocument
  componentName: string
  onComponentNameChange: (name: string) => void
}

export function CodePanel({ doc, componentName, onComponentNameChange }: CodePanelProps) {
  const [copied, setCopied] = useState(false)

  const code = useMemo(() => exportToTsx(doc, { componentName }), [doc, componentName])
  const stats = useMemo(() => exportStats(doc), [doc])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const download = () => {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${componentName || "GeneratedUI"}.tsx`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      <header className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
        <input
          value={componentName}
          onChange={(event) => onComponentNameChange(event.target.value)}
          spellCheck={false}
          className="w-40 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono text-[11px] text-neutral-100 outline-none focus:border-blue-500"
        />
        <span className="text-[11px] text-neutral-500">
          {stats.nodes} nodes · {stats.components} SDK components
        </span>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={copy}
            className="rounded border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={download}
            className="rounded border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-800"
          >
            Download
          </button>
        </div>
      </header>

      <pre className="builder-scroll flex-1 overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed text-neutral-200">
        <code>{code}</code>
      </pre>
    </div>
  )
}
