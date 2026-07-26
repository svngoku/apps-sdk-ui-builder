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
import { TextField, ToolButton } from "./ui"

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
    // The code panel is always dark: it reads as an editor surface, and pinning
    // `data-theme` keeps it stable when the canvas preview toggles theme.
    <div data-theme="dark" className="flex h-full flex-col bg-gray-25">
      <header className="flex shrink-0 items-center gap-2 border-b border-subtle px-3 py-2">
        <TextField
          value={componentName}
          onChange={(event) => onComponentNameChange(event.target.value)}
          spellCheck={false}
          aria-label="Exported component name"
          className="w-40 font-mono"
        />
        <span className="text-xs tabular-nums text-tertiary">
          {stats.nodes} nodes · {stats.components} SDK components
        </span>
        <div className="ms-auto flex gap-1">
          <ToolButton onClick={copy}>{copied ? "Copied" : "Copy"}</ToolButton>
          <ToolButton onClick={download}>Download</ToolButton>
        </div>
      </header>

      <pre className="builder-scroll flex-1 overflow-auto px-3 py-3 font-mono text-xs leading-relaxed text-secondary">
        <code>{code}</code>
      </pre>
    </div>
  )
}
