/**
 * Builder shell
 * -------------
 * Three-pane layout: palette, canvas, inspector. Owns the document history and
 * mediates every mutation so undo/redo covers the whole surface uniformly.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"

import { Canvas, PREVIEW_WIDTHS } from "./builder/Canvas"
import { CodePanel } from "./builder/CodePanel"
import { Inspector } from "./builder/Inspector"
import { LayerTree } from "./builder/LayerTree"
import { Palette } from "./builder/Palette"
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

/**
 * Toolbar `<select>` styling.
 *
 * The Apps SDK UI base stylesheet applies `appearance: none` to every
 * `input`/`select`, which strips the native control chrome *and* its intrinsic
 * width — a bare select then collapses or stretches unpredictably. Width and a
 * chevron have to be supplied explicitly.
 */
const SELECT =
  "appearance-none rounded border border-neutral-300 bg-white py-1 pl-2 pr-5 text-[11px] " +
  "text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"

/**
 * Width is set inline rather than via a utility class.
 *
 * The Apps SDK UI base layer sets `appearance: none` on every `select`, which
 * removes the intrinsic width a native control would size itself from. Layer
 * ordering between the SDK's base styles and Tailwind's utilities is not
 * something this app controls, so an inline style is the reliable way to pin
 * the size.
 */
const SELECT_STYLE: CSSProperties = { width: "8.5rem", flex: "0 0 auto" }

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
    <div className="flex h-dvh flex-col bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      {/* Toolbar */}
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <div className="flex shrink-0 items-baseline gap-2">
          <h1 className="whitespace-nowrap text-[13px] font-semibold">Apps SDK UI Builder</h1>
          <span className="text-[10px] text-neutral-500">v{SDK_VERSION}</span>
        </div>

        <div className="mx-2 h-4 w-px bg-neutral-200 dark:bg-neutral-800" />

        <ToolbarButton
          onClick={() => setHistory((current) => undo(current))}
          disabled={history.past.length === 0}
          label="Undo"
        />
        <ToolbarButton
          onClick={() => setHistory((current) => redo(current))}
          disabled={history.future.length === 0}
          label="Redo"
        />

        <div className="mx-2 h-4 w-px bg-neutral-200 dark:bg-neutral-800" />

        <select
          value={previewWidth === null ? "full" : String(previewWidth)}
          onChange={(event) =>
            setPreviewWidth(event.target.value === "full" ? null : Number(event.target.value))
          }
          className={SELECT}
          style={SELECT_STYLE}
        >
          {PREVIEW_WIDTHS.map((width) => (
            <option key={width.label} value={width.value === null ? "full" : String(width.value)}>
              {width.label}
              {width.value ? ` · ${width.value}px` : ""}
            </option>
          ))}
        </select>

        <ToolbarToggle active={dark} onClick={() => setDark((value) => !value)} label="Dark" />
        <ToolbarToggle
          active={!interactive}
          onClick={() => {
            setInteractive((value) => !value)
            setSelectedId(null)
          }}
          label="Preview"
          title="Disable editing affordances so components behave normally"
        />
        <ToolbarToggle active={showCode} onClick={() => setShowCode((v) => !v)} label="Code" />

        <div className="ml-auto flex items-center gap-1">
          {notice ? (
            <span className="mr-2 rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {notice}
            </span>
          ) : null}

          <select
            value=""
            onChange={(event) => {
              const template = STARTER_TEMPLATES.find((t) => t.name === event.target.value)
              if (!template) return
              setHistory(initHistory(template.build()))
              setSelectedId(null)
              flash(`Loaded “${template.name}”.`)
            }}
            className={SELECT}
            style={SELECT_STYLE}
          >
            <option value="">Templates…</option>
            {STARTER_TEMPLATES.map((template) => (
              <option key={template.name} value={template.name}>
                {template.name}
              </option>
            ))}
          </select>

          <ToolbarButton label="Import" onClick={() => fileInput.current?.click()} />
          <ToolbarButton label="Export" onClick={() => downloadProject(doc, componentName)} />
          <ToolbarButton
            label="Clear"
            onClick={() => {
              setHistory((current) => commit(current, { root: [] }))
              setSelectedId(null)
            }}
          />
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
        <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 dark:border-neutral-800">
          <div className="min-h-0 flex-1">
            <Palette onAdd={handleAdd} onDragComponent={setDraggingComponent} />
          </div>
          <div className="max-h-56 shrink-0 overflow-y-auto border-t border-neutral-200 dark:border-neutral-800">
            <h3 className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Layers
            </h3>
            <LayerTree
              nodes={doc.root}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onHover={setHoveredId}
            />
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
            <div className="h-64 shrink-0 border-t border-neutral-200 dark:border-neutral-800">
              <CodePanel
                doc={doc}
                componentName={componentName}
                onComponentNameChange={setComponentName}
              />
            </div>
          ) : null}
        </main>

        <aside className="w-72 shrink-0 border-l border-neutral-200 dark:border-neutral-800">
          <Inspector
            node={selectedNode}
            onChangeProp={handleChangeProp}
            onChangeText={handleChangeText}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
          />
        </aside>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Toolbar atoms                                                               */
/* -------------------------------------------------------------------------- */

function ToolbarButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-neutral-300 px-2 py-1 text-[11px] text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
    >
      {label}
    </button>
  )
}

function ToolbarToggle({
  label,
  active,
  onClick,
  title,
}: {
  label: string
  active: boolean
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        "rounded border px-2 py-1 text-[11px] transition-colors " +
        (active
          ? "border-blue-500 bg-blue-500 text-white"
          : "border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800")
      }
    >
      {label}
    </button>
  )
}
