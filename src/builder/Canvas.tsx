/**
 * Canvas
 * ------
 * Hosts the live preview and mediates drops.
 *
 * Drop resolution walks up from the event target through `data-node-id`
 * ancestors to find the nearest node that is allowed to contain what is being
 * dropped. That means a drop on a `Button`'s label still lands correctly in the
 * enclosing `Card`, which is what a user expects.
 */

import { useCallback, useRef, useState } from "react"

import { canContain, getEntry } from "../registry"
import type { UINode } from "../registry/types"
import type { UIDocument } from "../state/document"
import { renderNode, type RendererContext } from "./NodeRenderer"

export type PreviewWidth = { label: string; value: number | null }

export const PREVIEW_WIDTHS: PreviewWidth[] = [
  { label: "Compact", value: 420 },
  { label: "Inline", value: 640 },
  { label: "Wide", value: 960 },
  { label: "Full", value: null },
]

type CanvasProps = {
  doc: UIDocument
  selectedId: string | null
  hoveredId: string | null
  interactive: boolean
  width: number | null
  dark: boolean
  draggingComponent: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  /** Drop an entirely new component from the palette. */
  onDropComponent: (componentName: string, parentId: string | null, index: number) => void
  /** Reposition an existing node. */
  onMoveNode: (nodeId: string, parentId: string | null, index: number) => void
}

export function Canvas({
  doc,
  selectedId,
  hoveredId,
  interactive,
  width,
  dark,
  draggingComponent,
  onSelect,
  onHover,
  onDropComponent,
  onMoveNode,
}: CanvasProps) {
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const draggingNodeId = useRef<string | null>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)

  /**
   * Find the nearest ancestor element that maps to a node able to accept
   * `componentName` as a child.
   */
  const resolveDropTarget = useCallback(
    (target: EventTarget | null, componentName: string | null): string | null => {
      if (!(target instanceof Element) || !componentName) return null

      let element: Element | null = target
      while (element && surfaceRef.current?.contains(element)) {
        const id = element.getAttribute("data-node-id")
        if (id) {
          const node = findById(doc.root, id)
          if (node && canContain(node.component, componentName)) return id
        }
        element = element.parentElement
      }
      return null
    },
    [doc.root],
  )

  const currentDragName = useCallback((): string | null => {
    if (draggingComponent) return draggingComponent
    if (draggingNodeId.current) {
      const node = findById(doc.root, draggingNodeId.current)
      return node?.component ?? null
    }
    return null
  }, [doc.root, draggingComponent])

  const handleDragOver = (event: React.DragEvent) => {
    if (!interactive) return
    event.preventDefault()
    event.dataTransfer.dropEffect = draggingComponent ? "copy" : "move"
    setDropTargetId(resolveDropTarget(event.target, currentDragName()))
  }

  const handleDrop = (event: React.DragEvent) => {
    if (!interactive) return
    event.preventDefault()

    const componentName = event.dataTransfer.getData("application/x-component")
    const nodeId = event.dataTransfer.getData("application/x-node-id")

    const movingName = componentName || findById(doc.root, nodeId)?.component || null
    const parentId = resolveDropTarget(event.target, movingName)

    // Dropping outside any valid container appends at the document root.
    const index = parentId
      ? (findById(doc.root, parentId)?.children.length ?? 0)
      : doc.root.length

    if (componentName) {
      onDropComponent(componentName, parentId, index)
    } else if (nodeId) {
      onMoveNode(nodeId, parentId, index)
    }

    setDropTargetId(null)
    draggingNodeId.current = null
  }

  const ctx: RendererContext = {
    selectedId,
    hoveredId,
    dropTargetId,
    interactive,
    draggingId: draggingNodeId.current,
    onSelect,
    onHover,
    onDropInto: () => {},
    onDragStartNode: (id) => {
      draggingNodeId.current = id
    },
  }

  return (
    <div
      className="builder-scroll flex h-full justify-center overflow-auto bg-neutral-100 p-8 dark:bg-neutral-950"
      onClick={() => interactive && onSelect(null)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={() => setDropTargetId(null)}
    >
      <div
        ref={surfaceRef}
        className={
          "h-fit min-h-[240px] w-full rounded-xl bg-page p-6 shadow-sm transition-[max-width] " +
          (dark ? "dark" : "")
        }
        style={{ maxWidth: width ?? "100%" }}
        data-canvas-surface="true"
      >
        {doc.root.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-300 text-center dark:border-neutral-700">
            <p className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400">
              Drag a component here
            </p>
            <p className="text-[11px] text-neutral-500">
              or click one in the palette to add it
            </p>
          </div>
        ) : (
          doc.root.map((node, index) =>
            renderNode({ node, ctx, index, parentId: null }),
          )
        )}
      </div>
    </div>
  )
}

function findById(nodes: UINode[], id: string): UINode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    const nested = findById(node.children, id)
    if (nested) return nested
  }
  return undefined
}

export { getEntry }
