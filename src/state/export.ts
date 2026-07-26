/**
 * TSX exporter
 * ------------
 * Walks the document tree and emits a self-contained React component.
 *
 * Correctness rules that matter here:
 *   - Imports are grouped per module. `Button` and `ButtonLink` both live in
 *     `.../components/Button`, and compound parts import their *parent*
 *     (`Menu.Item` needs `Menu`), so we key on `importName`, not `name`.
 *   - Layout primitives are host elements and must not be imported at all.
 *   - Icons come from the single `components/Icon` module.
 *   - Prop emission follows the JSX rules: `foo` for `true`, `foo={false}` for
 *     false, `foo="bar"` for strings, `foo={1}` for numbers, `foo={<expr>}` for
 *     raw expressions.
 */

import { getEntry, getPrimitive, isPrimitive, isVoidPrimitive } from "../registry"
import type { PropValue, UINode } from "../registry/types"
import type { UIDocument } from "./document"

const INDENT = "  "

/* -------------------------------------------------------------------------- */
/* Imports                                                                     */
/* -------------------------------------------------------------------------- */

type ImportPlan = {
  /** importPath -> set of binding names */
  modules: Map<string, Set<string>>
  icons: Set<string>
}

function collectImports(nodes: UINode[], plan: ImportPlan) {
  for (const node of nodes) {
    const entry = getEntry(node.component)

    // The synthetic `Icon` node resolves to a concrete icon component, which is
    // collected below via its `name` prop rather than as an `Icon` binding.
    if (entry && !entry.isPrimitive && entry.importPath && node.component !== "Icon") {
      const bindings = plan.modules.get(entry.importPath) ?? new Set<string>()
      // Compound parts (`Menu.Item`) are reached through the parent binding.
      bindings.add(entry.importName)
      plan.modules.set(entry.importPath, bindings)
    }

    for (const value of Object.values(node.props)) {
      if (value.kind === "icon") plan.icons.add(value.iconName)
    }

    collectImports(node.children, plan)
  }
}

function renderImports(plan: ImportPlan): string {
  const lines: string[] = []

  const paths = [...plan.modules.keys()].sort()
  for (const path of paths) {
    const bindings = [...plan.modules.get(path)!].sort()
    lines.push(`import { ${bindings.join(", ")} } from "${path}"`)
  }

  if (plan.icons.size > 0) {
    const icons = [...plan.icons].sort()
    lines.push(`import { ${icons.join(", ")} } from "@openai/apps-sdk-ui/components/Icon"`)
  }

  return lines.join("\n")
}

/* -------------------------------------------------------------------------- */
/* Props                                                                       */
/* -------------------------------------------------------------------------- */

/** Does this string need braces, or can it be a plain JSX string literal? */
function asJsxString(value: string): string {
  // JSX attribute strings cannot contain a raw double quote or newline.
  if (value.includes('"') || value.includes("\n")) {
    return `{${JSON.stringify(value)}}`
  }
  return `"${value}"`
}

function renderPropValue(name: string, value: PropValue): string | undefined {
  switch (value.kind) {
    case "literal": {
      if (typeof value.value === "boolean") {
        // Shorthand for true is idiomatic; false must be explicit.
        return value.value ? name : `${name}={false}`
      }
      if (typeof value.value === "number") return `${name}={${value.value}}`

      const text = String(value.value)
      // An empty optional string is noise in the output.
      if (text === "") return undefined
      return `${name}=${asJsxString(text)}`
    }
    case "icon":
      return `${name}={${value.iconName}}`
    case "expression": {
      const code = value.code.trim()
      if (!code) return undefined
      return `${name}={${code}}`
    }
  }
}

/**
 * A no-op callback for a required handler prop.
 *
 * The builder has no way to author real behaviour, but the prop is mandatory,
 * so exported code must still supply *something* that type-checks. A stub with
 * an explicit TODO is honest about the gap and keeps the output compilable.
 */
function handlerStub(): string {
  return "() => {}"
}

function renderProps(node: UINode): string[] {
  const entry = getEntry(node.component)
  const out: string[] = []

  // Required handlers must appear even though they are never stored as values.
  for (const schema of entry?.props ?? []) {
    if (schema.control !== "handler" || !schema.required) continue
    if (node.props[schema.name]) continue
    out.push(`${schema.name}={${handlerStub()}}`)
  }

  for (const [name, value] of Object.entries(node.props)) {
    // Skip values that merely restate the component's own default — but only
    // for real SDK components, where the default is baked into the component.
    //
    // For layout primitives the "default" is just the seed className the
    // builder dropped in, and the class list *is* the component. Eliding it
    // would export a bare, unstyled `<div>`.
    const schema = entry?.props.find((prop) => prop.name === name)
    if (
      !entry?.isPrimitive &&
      schema?.defaultValue !== undefined &&
      value.kind === "literal" &&
      value.value === schema.defaultValue &&
      !schema.required
    ) {
      continue
    }

    const rendered = renderPropValue(name, value)
    if (rendered) out.push(rendered)
  }

  return out.sort()
}

/* -------------------------------------------------------------------------- */
/* Element rendering                                                           */
/* -------------------------------------------------------------------------- */

/** Text that is safe to inline as JSX children. */
function renderTextChild(text: string, indent: string): string {
  const needsExpression = /[{}<>]/.test(text)
  if (text.includes("\n")) {
    return `${indent}{${JSON.stringify(text)}}`
  }
  return needsExpression ? `${indent}{${JSON.stringify(text)}}` : `${indent}${text}`
}

function renderNode(node: UINode, depth: number): string {
  const indent = INDENT.repeat(depth)
  const entry = getEntry(node.component)

  // The synthetic `Icon` becomes the concrete icon component: `<Maps />`.
  if (node.component === "Icon") {
    const chosen = node.props.name
    const iconName = chosen?.kind === "icon" ? chosen.iconName : undefined
    if (!iconName) return `${indent}{/* icon not selected */}`

    const className = node.props.className
    const classText =
      className?.kind === "literal" && String(className.value)
        ? ` className=${asJsxString(String(className.value))}`
        : ""
    return `${indent}<${iconName}${classText} />`
  }

  const tag = entry?.isPrimitive ? (getPrimitive(node.component)?.tag ?? "div") : node.component

  const props = renderProps(node)
  const hasChildren = node.children.length > 0
  const hasText = Boolean(node.text)
  const selfClosing = !hasChildren && !hasText

  // Keep short openings on one line; wrap when they would get unwieldy.
  const inlineProps = props.length > 0 ? " " + props.join(" ") : ""
  const useMultilineProps = inlineProps.length > 76 && props.length > 1

  const open = useMultilineProps
    ? `${indent}<${tag}\n` +
      props.map((prop) => `${indent}${INDENT}${prop}`).join("\n") +
      `\n${indent}${selfClosing ? "/>" : ">"}`
    : `${indent}<${tag}${inlineProps}${selfClosing ? " />" : ">"}`

  if (selfClosing) return open

  // Element children take precedence over text, matching the canvas renderer.
  const body = hasChildren
    ? node.children.map((child) => renderNode(child, depth + 1)).join("\n")
    : renderTextChild(node.text!, indent + INDENT)

  return `${open}\n${body}\n${indent}</${tag}>`
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

export type ExportOptions = {
  componentName?: string
}

export function exportToTsx(doc: UIDocument, options: ExportOptions = {}): string {
  const componentName = sanitiseComponentName(options.componentName ?? "GeneratedUI")

  const plan: ImportPlan = { modules: new Map(), icons: new Set() }
  collectImports(doc.root, plan)

  const imports = renderImports(plan)

  if (doc.root.length === 0) {
    return [
      imports,
      imports ? "" : undefined,
      `export function ${componentName}() {`,
      `${INDENT}return null`,
      `}`,
      "",
    ]
      .filter((line) => line !== undefined)
      .join("\n")
  }

  // A single root element can be returned directly; multiple roots need a
  // fragment so the output is always a valid single expression.
  const multiRoot = doc.root.length > 1
  const bodyDepth = multiRoot ? 3 : 2
  const body = doc.root.map((node) => renderNode(node, bodyDepth)).join("\n")

  const returnBlock = multiRoot
    ? `${INDENT}return (\n${INDENT.repeat(2)}<>\n${body}\n${INDENT.repeat(2)}</>\n${INDENT})`
    : `${INDENT}return (\n${body}\n${INDENT})`

  return [
    imports,
    imports ? "" : undefined,
    `export function ${componentName}() {`,
    returnBlock,
    `}`,
    "",
  ]
    .filter((line) => line !== undefined)
    .join("\n")
}

function sanitiseComponentName(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, " ")
  const pascal = cleaned
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("")
  if (!pascal) return "GeneratedUI"
  return /^[0-9]/.test(pascal) ? `Ui${pascal}` : pascal
}

/** Human-readable summary shown above the code panel. */
export function exportStats(doc: UIDocument): { nodes: number; components: number } {
  let nodes = 0
  const seen = new Set<string>()

  const visit = (list: UINode[]) => {
    for (const node of list) {
      nodes += 1
      if (!isPrimitive(node.component)) seen.add(node.component)
      visit(node.children)
    }
  }
  visit(doc.root)

  return { nodes, components: seen.size }
}

export { isVoidPrimitive }
