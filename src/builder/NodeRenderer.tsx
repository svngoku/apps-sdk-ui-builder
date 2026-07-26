/**
 * Node renderer
 * -------------
 * Renders a document node as the real Apps SDK UI component.
 *
 * The hard constraint: selection and drag affordances must not distort the
 * component being previewed. So instead of wrapping every node in a positioned
 * div (which would break flex/grid parents and Radix's trigger/content
 * relationships), the renderer injects `data-*` attributes and interaction
 * handlers into the component's own props. Outlines are drawn with CSS
 * `outline`, which does not participate in layout.
 *
 * Components that reject unknown DOM props are the exception, and get a
 * lightweight wrapper — see `NEEDS_WRAPPER`.
 */

import { createElement, type CSSProperties, type ReactNode } from "react"

import { getEntry, getPrimitive, isVoidPrimitive } from "../registry"
import type { UINode } from "../registry/types"
import { getComponent, getIcon } from "./componentMap"

export type RendererContext = {
  selectedId: string | null
  hoveredId: string | null
  dropTargetId: string | null
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  onDropInto: (parentId: string, index: number) => void
  onDragStartNode: (id: string) => void
  draggingId: string | null
  /** Interaction is disabled in preview mode so components behave normally. */
  interactive: boolean
}

/**
 * Radix-based parts validate their children or rely on `asChild` slots, so
 * injecting `data-*`/handlers directly can break them. These render inside a
 * `display: contents` wrapper instead, which carries the affordances without
 * introducing a layout box.
 */
const NEEDS_WRAPPER = new Set([
  "Menu",
  "Menu.Trigger",
  "Menu.Content",
  "Menu.Sub",
  "Menu.SubTrigger",
  "Menu.SubContent",
  "Menu.RadioGroup",
  "Popover",
  "Popover.Trigger",
  "Popover.Content",
  "Tooltip",
  "Tooltip.Root",
  "Tooltip.Trigger",
  "Tooltip.Content",
  "Tooltip.TriggerDecorator",
  "Select",
  "DatePicker",
  "DateRangePicker",
  "SegmentedControl",
  "RadioGroup",
  "Slider",
  "Switch",
  "Checkbox",
  "TagInput",
])

const CONTENTS: CSSProperties = { display: "contents" }

/** Shared no-op for required handler props the builder cannot author. */
const NOOP = () => {}

/** Convert stored prop values into real runtime values. */
function materialiseProps(node: UINode): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  // Required event handlers are not authorable in the builder, but the
  // components genuinely call them (`Slider` invokes `onChange` during render
  // setup and throws "Expected a function" without it). Supply no-op stubs so
  // the canvas mounts — the exporter emits matching stubs in the output.
  for (const schema of getEntry(node.component)?.props ?? []) {
    if (schema.control === "handler" && schema.required) {
      out[schema.name] = NOOP
    }
  }

  for (const [name, value] of Object.entries(node.props)) {
    switch (value.kind) {
      case "literal":
        out[name] = value.value
        break
      case "icon": {
        const Icon = getIcon(value.iconName)
        if (Icon) out[name] = Icon
        break
      }
      case "expression":
        out[name] = evaluateExpression(value.code)
        break
    }
  }

  return out
}

/**
 * Evaluate a raw expression prop (e.g. a `Select` options array).
 *
 * This is a builder-local authoring affordance, not a runtime feature of the
 * exported app: the code the user types here is emitted verbatim into the TSX
 * output, and is only evaluated to power the live preview. A malformed
 * expression degrades to `undefined` rather than taking down the canvas.
 */
function evaluateExpression(code: string): unknown {
  const trimmed = code.trim()
  if (!trimmed) return undefined

  // Try strict JSON first — the common case and the safe one.
  try {
    return JSON.parse(trimmed)
  } catch {
    /* fall through to relaxed parsing */
  }

  try {
    // eslint-disable-next-line no-new-func
    return new Function(`"use strict"; return (${trimmed})`)()
  } catch {
    return undefined
  }
}

type RenderArgs = {
  node: UINode
  ctx: RendererContext
  /** Position within the parent; reserved for index-precise drop indicators. */
  index?: number
  parentId?: string | null
}

export function renderNode({ node, ctx }: RenderArgs): ReactNode {
  const entry = getEntry(node.component)
  if (!entry) {
    return (
      <div key={node.id} className="rounded border border-dashed p-2 text-xs opacity-60">
        Unknown component: {node.component}
      </div>
    )
  }

  const isSelected = ctx.selectedId === node.id
  const isHovered = ctx.hoveredId === node.id
  const isDropTarget = ctx.dropTargetId === node.id

  const affordances: Record<string, unknown> = ctx.interactive
    ? {
        "data-node-id": node.id,
        "data-node-selected": isSelected ? "true" : undefined,
        "data-node-hovered": isHovered ? "true" : undefined,
        "data-drop-target": isDropTarget ? "true" : undefined,
        "onClick": (event: React.MouseEvent) => {
          event.stopPropagation()
          event.preventDefault()
          ctx.onSelect(node.id)
        },
        "onMouseOver": (event: React.MouseEvent) => {
          event.stopPropagation()
          ctx.onHover(node.id)
        },
        "onMouseOut": (event: React.MouseEvent) => {
          event.stopPropagation()
          ctx.onHover(null)
        },
        "draggable": true,
        "onDragStart": (event: React.DragEvent) => {
          event.stopPropagation()
          event.dataTransfer.setData("application/x-node-id", node.id)
          event.dataTransfer.effectAllowed = "move"
          ctx.onDragStartNode(node.id)
        },
      }
    : {}

  /* --------------------------- Children ---------------------------------- */

  let children: ReactNode = undefined

  // Element children win over text: a node that has been given real children is
  // a container, and any leftover starter text is stale.
  if (node.children.length > 0) {
    const rendered = node.children.map((child, childIndex) =>
      renderNode({ node: child, ctx, index: childIndex, parentId: node.id }),
    )
    // Radix `asChild` triggers call `React.Children.only`, which rejects an
    // array even when it holds exactly one element. Unwrap the single-child
    // case so `Menu.Trigger`, `Popover.Trigger`, and `Tooltip.Trigger` can slot
    // their child correctly.
    children = rendered.length === 1 ? rendered[0] : rendered
  } else if (node.text !== undefined && node.text !== "") {
    children = node.text
  } else if (entry.acceptsChildren && ctx.interactive) {
    // An empty container is invisible without a placeholder, which makes it
    // impossible to target as a drop zone.
    children = (
      <span data-empty-slot="true" className="w-full">
        Drop components here
      </span>
    )
  }

  /* ---------------------------- Element ---------------------------------- */

  const runtimeProps = materialiseProps(node)
  const needsWrapper = NEEDS_WRAPPER.has(node.component)

  let element: ReactNode

  // The synthetic `Icon` node renders whichever concrete icon was picked.
  if (node.component === "Icon") {
    const chosen = node.props.name
    const IconComponent = chosen?.kind === "icon" ? getIcon(chosen.iconName) : undefined

    if (!IconComponent) {
      return (
        <span
          key={node.id}
          {...affordances}
          className="inline-flex size-4 items-center justify-center rounded border border-dashed text-[9px] opacity-60"
          title="No icon selected"
        >
          ?
        </span>
      )
    }

    const className = node.props.className
    return (
      <IconComponent
        key={node.id}
        className={className?.kind === "literal" ? String(className.value) : "size-4"}
        {...affordances}
      />
    )
  }

  if (entry.isPrimitive) {
    const primitive = getPrimitive(node.component)
    const tag = primitive?.tag ?? "div"

    element = createElement(
      tag,
      {
        key: node.id,
        ...runtimeProps,
        ...(needsWrapper ? {} : affordances),
      },
      isVoidPrimitive(node.component) ? undefined : children,
    )
  } else {
    const Component = getComponent(node.component)
    if (!Component) {
      return (
        <div key={node.id} className="rounded border border-dashed p-2 text-xs opacity-60">
          {node.component} is not mapped
        </div>
      )
    }

    element = createElement(
      Component,
      {
        key: node.id,
        ...runtimeProps,
        ...(needsWrapper ? {} : affordances),
      },
      entry.acceptsChildren ? children : undefined,
    )
  }

  if (!needsWrapper || !ctx.interactive) return element

  // `display: contents` keeps the wrapper out of the layout while still
  // carrying selection affordances for components that can't take them.
  return (
    <div key={node.id} style={CONTENTS} {...affordances}>
      {element}
    </div>
  )
}

export { materialiseProps }
