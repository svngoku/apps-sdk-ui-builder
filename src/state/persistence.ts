/**
 * Persistence
 * -----------
 * Local-storage autosave plus JSON import/export. No backend: the document is a
 * plain serialisable tree, so a file round-trip is the whole portability story.
 *
 * Loading is defensive — a stored document may predate a schema change, and a
 * corrupt autosave should never prevent the builder from starting.
 */

import type { UINode } from "../registry/types"
import { emptyDocument, type UIDocument } from "./document"

const STORAGE_KEY = "appsdk-ui-builder:document:v1"
const NAME_KEY = "appsdk-ui-builder:name:v1"

export type SerialisedProject = {
  version: 1
  componentName: string
  document: UIDocument
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

function isNode(value: unknown): value is UINode {
  if (typeof value !== "object" || value === null) return false
  const node = value as Partial<UINode>
  return (
    typeof node.id === "string" &&
    typeof node.component === "string" &&
    typeof node.props === "object" &&
    node.props !== null &&
    Array.isArray(node.children) &&
    node.children.every(isNode)
  )
}

function isDocument(value: unknown): value is UIDocument {
  if (typeof value !== "object" || value === null) return false
  const doc = value as Partial<UIDocument>
  return Array.isArray(doc.root) && doc.root.every(isNode)
}

/* -------------------------------------------------------------------------- */
/* Local storage                                                               */
/* -------------------------------------------------------------------------- */

export function saveLocal(doc: UIDocument, componentName: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
    localStorage.setItem(NAME_KEY, componentName)
  } catch {
    // Quota exceeded or storage disabled — autosave is best-effort.
  }
}

export function loadLocal(): { doc: UIDocument; componentName: string } {
  const fallback = { doc: emptyDocument(), componentName: "GeneratedUI" }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback

    const parsed: unknown = JSON.parse(raw)
    if (!isDocument(parsed)) return fallback

    return {
      doc: parsed,
      componentName: localStorage.getItem(NAME_KEY) || fallback.componentName,
    }
  } catch {
    return fallback
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(NAME_KEY)
  } catch {
    /* ignore */
  }
}

/* -------------------------------------------------------------------------- */
/* File import / export                                                        */
/* -------------------------------------------------------------------------- */

export function downloadProject(doc: UIDocument, componentName: string): void {
  const payload: SerialisedProject = { version: 1, componentName, document: doc }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${componentName || "ui"}.appsdkui.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function readProjectFile(
  file: File,
): Promise<{ doc: UIDocument; componentName: string } | { error: string }> {
  try {
    const text = await file.text()
    const parsed: unknown = JSON.parse(text)

    // Accept both the wrapped project format and a bare document.
    if (isDocument(parsed)) return { doc: parsed, componentName: "GeneratedUI" }

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      isDocument((parsed as SerialisedProject).document)
    ) {
      const project = parsed as SerialisedProject
      return {
        doc: project.document,
        componentName: project.componentName || "GeneratedUI",
      }
    }

    return { error: "That file does not look like a builder project." }
  } catch {
    return { error: "Could not parse that file as JSON." }
  }
}
