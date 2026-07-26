/**
 * Builder shell
 * -------------
 * Three-pane layout: palette, canvas, inspector. Owns the document history and
 * mediates every mutation so undo/redo covers the whole surface uniformly.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Canvas, PREVIEW_WIDTHS } from "./builder/Canvas"
import { CodePanel } from "./builder/CodePanel"
import { Inspector } from "./builder/Inspector"
import { LayerTree } from "./builder/LayerTree"
import { Palette } from "./builder/Palette"
import { SectionLabel, Select, ToolbarDivider, ToolButton } from "./builder/ui"
import { cn } from "./lib/cn"
import { SDK_VERSION } from "./registry"
import type { PropValue } from "./registry/types"
import {
  addComponent,
  commit,
  duplicateNode,
  findNode,
  initHistory,
  moveNode,
  redo,
  removeNode,
  setProp,
  setText,
  shiftNode,
  undo,
  type History,
} from "./state/document"
import { downloadProject, loadLocal, readProjectFile, saveLocal } from "./state/persistence"
import { STARTER_TEMPLATES } from "./state/templates"

export default function App() {
  const initial = useMemo(() => loadLocal(), [])

  const [history, setHistory] = useState<History>(() => initHistory(initial.doc))
  const [componentName, setComponentName] = useState(initial.componentName)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [draggingComponent, setDraggingComponent] = useState<string | null>(null)
  const [previewWidth, setPreviewWidth] = useState<number | null>(PREVIEW_WIDTHS[1].value)
  const [dark, setDark] = useState(false)
  const [interactive, setInteractive] = useState(true)
  const [showCode, setShowCode] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  // Clearing the canvas is irreversible from the user's point of view, so it
  // asks first rather than relying on them discovering undo.
  const [confirmClear, setConfirmClear] = useState(false)

  const doc = history.present
  const fileInput = useRef<HTMLInputElement>(null)

  /* --------------------------- Persistence ------------------------------- */

  useEffect(() => {
    const timer = setTimeout(() => saveLocal(doc, componentName), 400)
    return () => clearTimeout(timer)
  }, [doc, componentName])

  const flash = useCallback((message: string) => {
    setNotice(message)
    setTimeout(() => setNotice(null), 2200)
  }, [])

  /* ---------------------------- Mutations -------------------------------- */

  const apply = useCallback((next: typeof doc) => {
    setHistory((current) => commit(current, next))
  }, [])

  const handleAdd = useCallback(
    (componentToAdd: string) => {
      // Prefer inserting into the selection when it can hold the component;
      // clicking a palette item while a Card is selected should fill the Card.
      const parentId = selectedId
      const parentNode = parentId ? findNode(doc, parentId) : undefined

      const attempt = parentNode
        ? addComponent(doc, componentToAdd, {
            parentId: parentNode.id,
            index: parentNode.children.length,
          })
        : { doc, nodeId: undefined }

      const result =
        attempt.nodeId !== undefined
          ? attempt
          : addComponent(doc, componentToAdd, { parentId: null, index: doc.root.length })

      if (result.nodeId === undefined) {
        flash(`${componentToAdd} can't be placed there.`)
        return
      }

      apply(result.doc)
      setSelectedId(result.nodeId)
    },
    [apply, doc, flash, selectedId],
  )

  const handleDropComponent = useCallback(
    (componentToAdd: string, parentId: string | null, index: number) => {
      const result = addComponent(doc, componentToAdd, { parentId, index })
      if (result.nodeId === undefined) {
        flash(`${componentToAdd} can't be placed there.`)
        return
      }
      apply(result.doc)
      setSelectedId(result.nodeId)
      setDraggingComponent(null)
    },
    [apply, doc, flash],
  )

  const handleMoveNode = useCallback(
    (nodeId: string, parentId: string | null, index: number) => {
      const next = moveNode(doc, nodeId, { parentId, index })
      if (next === doc) {
        flash("That move isn't allowed here.")
        return
      }
      apply(next)
    },
    [apply, doc, flash],
  )

  const handleChangeProp = useCallback(
    (name: string, value: PropValue | undefined) => {
      if (!selectedId) return
      apply(setProp(doc, selectedId, name, value))
    },
    [apply, doc, selectedId],
  )

  const handleChangeText = useCallback(
    (text: string) => {
      if (!selectedId) return
      apply(setText(doc, selectedId, text))
    },
    [apply, doc, selectedId],
  )

  const handleDelete = useCallback(() => {
    if (!selectedId) return
    apply(removeNode(doc, selectedId))
    setSelectedId(null)
  }, [apply, doc, selectedId])

  const handleDuplicate = useCallback(() => {
    if (!selectedId) return
    const result = duplicateNode(doc, selectedId)
    if (result.nodeId) {
      apply(result.doc)
      setSelectedId(result.nodeId)
    }
  }, [apply, doc, selectedId])

  /* ---------------------------- Shortcuts -------------------------------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      if (typing) return

      const mod = event.metaKey || event.ctrlKey

      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault()
        setHistory((current) => (event.shiftKey ? redo(current) : undo(current)))
        return
      }
      if (mod && event.key.toLowerCase() === "d" && selectedId) {
        event.preventDefault()
        handleDuplicate()
        return
      }
      if ((event.key === "Backspace" || event.key === "Delete") && selectedId) {
        event.preventDefault()
        handleDelete()
        return
      }
      if (event.key === "Escape") {
        setSelectedId(null)
        return
      }
      if (selectedId && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault()
        apply(shiftNode(doc, selectedId, event.key === "ArrowUp" ? -1 : 1))
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [apply, doc, handleDelete, handleDuplicate, selectedId])

  /* ------------------------------ Files ---------------------------------- */

  const handleImport = async (file: File) => {
    const result = await readProjectFile(file)
    if ("error" in result) {
      flash(result.error)
      return
    }
    setHistory(initHistory(result.doc))
    setComponentName(result.componentName)
    setSelectedId(null)
    flash("Project imported.")
  }

  const selectedNode = selectedId ? (findNode(doc, selectedId) ?? null) : null

  /* ------------------------------ Render --------------------------------- */

  return (
    <div className="flex h-dvh flex-col bg-surface text-gray-900">
      {/* Toolbar */}
      <header className="flex shrink-0 items-center gap-1.5 border-b border-subtle px-3 py-2">
        <div className="flex shrink-0 items-baseline gap-2">
          <h1 className="whitespace-nowrap text-sm font-semibold">Apps SDK UI Builder</h1>
          <span className="text-xs tabular-nums text-tertiary">v{SDK_VERSION}</span>
        </div>

        <ToolbarDivider />

        <ToolButton
          onClick={() => setHistory((current) => undo(current))}
          disabled={history.past.length === 0}
        >
          Undo
        </ToolButton>
        <ToolButton
          onClick={() => setHistory((current) => redo(current))}
          disabled={history.future.length === 0}
        >
          Redo
        </ToolButton>

        <ToolbarDivider />

        <Select
          aria-label="Preview width"
          value={previewWidth === null ? "full" : String(previewWidth)}
          onChange={(event) =>
            setPreviewWidth(event.target.value === "full" ? null : Number(event.target.value))
          }
        >
          {PREVIEW_WIDTHS.map((width) => (
            <option key={width.label} value={width.value === null ? "full" : String(width.value)}>
              {width.label}
              {width.value ? ` · ${width.value}px` : ""}
            </option>
          ))}
        </Select>

        <ToolButton
          variant={dark ? "active" : "default"}
          aria-pressed={dark}
          onClick={() => setDark((value) => !value)}
          title="Preview the canvas with the SDK's dark theme"
        >
          Dark
        </ToolButton>
        <ToolButton
          variant={!interactive ? "active" : "default"}
          aria-pressed={!interactive}
          onClick={() => {
            setInteractive((value) => !value)
            setSelectedId(null)
          }}
          title="Disable editing affordances so components behave normally"
        >
          Preview
        </ToolButton>
        <ToolButton
          variant={showCode ? "active" : "default"}
          aria-pressed={showCode}
          onClick={() => setShowCode((value) => !value)}
        >
          Code
        </ToolButton>

        <div className="ms-auto flex items-center gap-1.5">
          {/* Status messages appear next to the controls that trigger them. */}
          <span aria-live="polite" className="text-xs text-pretty text-tertiary">
            {notice}
          </span>

          <Select
            aria-label="Load a starter template"
            value=""
            onChange={(event) => {
              const template = STARTER_TEMPLATES.find((t) => t.name === event.target.value)
              if (!template) return
              setHistory(initHistory(template.build()))
              setSelectedId(null)
              flash(`Loaded “${template.name}”.`)
            }}
          >
            <option value="">Templates…</option>
            {STARTER_TEMPLATES.map((template) => (
              <option key={template.name} value={template.name}>
                {template.name}
              </option>
            ))}
          </Select>

          <ToolButton onClick={() => fileInput.current?.click()}>Import</ToolButton>
          <ToolButton onClick={() => downloadProject(doc, componentName)}>Export</ToolButton>
          <ToolButton
            variant="danger"
            onClick={() => setConfirmClear(true)}
            disabled={doc.root.length === 0}
          >
            Clear
          </ToolButton>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleImport(file)
              event.target.value = ""
            }}
          />
        </div>
      </header>

      {/* Panes */}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-60 shrink-0 flex-col border-e border-subtle">
          <div className="min-h-0 flex-1">
            <Palette onAdd={handleAdd} onDragComponent={setDraggingComponent} />
          </div>
          <div className="flex max-h-56 shrink-0 flex-col overflow-hidden border-t border-subtle">
            <SectionLabel className="px-3 pt-2">Layers</SectionLabel>
            <div className="builder-scroll overflow-y-auto">
              <LayerTree
                nodes={doc.root}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onHover={setHoveredId}
              />
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <Canvas
              doc={doc}
              selectedId={selectedId}
              hoveredId={hoveredId}
              interactive={interactive}
              width={previewWidth}
              dark={dark}
              draggingComponent={draggingComponent}
              onSelect={setSelectedId}
              onHover={setHoveredId}
              onDropComponent={handleDropComponent}
              onMoveNode={handleMoveNode}
            />
          </div>
          {showCode ? (
            <div className="h-64 shrink-0 border-t border-subtle">
              <CodePanel
                doc={doc}
                componentName={componentName}
                onComponentNameChange={setComponentName}
              />
            </div>
          ) : null}
        </main>

        <aside className="w-72 shrink-0 border-s border-subtle">
          <Inspector
            node={selectedNode}
            onChangeProp={handleChangeProp}
            onChangeText={handleChangeText}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
          />
        </aside>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear the canvas?"
        body={`This removes all ${doc.root.length} top-level component${
          doc.root.length === 1 ? "" : "s"
        }. You can still undo with ⌘Z.`}
        confirmLabel="Clear canvas"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setHistory((current) => commit(current, { root: [] }))
          setSelectedId(null)
          setConfirmClear(false)
        }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Confirm dialog                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Confirmation for destructive, irreversible actions.
 *
 * Built on the native `<dialog>` element rather than a hand-rolled overlay:
 * the platform already provides the modal semantics, focus trapping, backdrop,
 * and Escape-to-close that would otherwise have to be reimplemented — and
 * reimplemented focus management is where custom modals usually go wrong.
 */
function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  // `showModal()` is imperative by nature, so the DOM state is synced to the
  // `open` prop rather than expressed declaratively.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      onClick={(event) => {
        // Clicking the backdrop (the dialog element itself) dismisses.
        if (event.target === ref.current) onCancel()
      }}
      className={cn(
        "m-auto w-90 max-w-[calc(100vw-2rem)] rounded-xl border border-default bg-surface p-0",
        "text-gray-900 shadow-lg backdrop:bg-black/40",
      )}
      aria-labelledby="confirm-title"
    >
      <div className="p-4">
        <h2 id="confirm-title" className="text-sm font-semibold text-balance">
          {title}
        </h2>
        <p className="mt-1 text-xs text-pretty text-secondary">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <ToolButton onClick={onCancel} autoFocus>
            Cancel
          </ToolButton>
          <ToolButton variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </ToolButton>
        </div>
      </div>
    </dialog>
  )
}
