/**
 * Registry facade
 * ---------------
 * Merges the generated manifest with the hand-authored overlay and exposes the
 * lookups the builder needs. Everything downstream (palette, canvas, inspector,
 * exporter) reads from here, so the rest of the app never needs to know whether
 * a given fact was derived from types or from editorial judgement.
 */

import generated from "./registry.generated.json"
import {
  CATEGORY_ORDER,
  DEFAULT_CATEGORY,
  LAYOUT_PRIMITIVES,
  LAYOUT_PRIMITIVE_NAMES,
  OVERLAY,
  TEXTUAL_PRIMITIVES,
  VOID_PRIMITIVES,
  type Category,
  type OverlayEntry,
  type StarterChild,
} from "./overlay"
import type { ComponentSchema, GeneratedRegistry, PropValue, UINode } from "./types"

const registry = generated as unknown as GeneratedRegistry

export const SDK_VERSION = registry.sdkVersion
export const ICON_NAMES: string[] = registry.icons

/* -------------------------------------------------------------------------- */
/* Entries                                                                     */
/* -------------------------------------------------------------------------- */

/** A palette-ready component: generated schema plus overlay metadata. */
export type RegistryEntry = ComponentSchema & {
  category: Category
  blurb?: string
  isPrimitive: boolean
  hidden: boolean
  overlay: OverlayEntry | undefined
}

/**
 * Layout primitives are synthesised as registry entries so that the canvas,
 * inspector, and exporter can treat "a div with classes" and "a Button" through
 * exactly one code path.
 */
const primitiveEntries: RegistryEntry[] = LAYOUT_PRIMITIVES.map((primitive) => ({
  name: primitive.name,
  importName: primitive.name,
  module: "__primitive__",
  importPath: "",
  props: [
    {
      name: "className",
      control: "string" as const,
      required: false,
      defaultValue: primitive.defaultClassName,
      description: "Tailwind utility classes",
      typeText: "string",
    },
  ],
  acceptsChildren: !VOID_PRIMITIVES.has(primitive.name),
  requiresChildren: false,
  category: "Layout" as Category,
  blurb: primitive.description,
  isPrimitive: true,
  hidden: false,
  overlay: undefined,
}))

/**
 * Synthetic `Icon` entry.
 *
 * The SDK exposes 745 individual icon components rather than one `<Icon
 * name="..."/>`. Surfacing 745 palette entries would be unusable, so the
 * builder offers a single `Icon` placeholder whose `name` prop drives an icon
 * picker. The renderer resolves it to the real component and the exporter emits
 * the concrete tag (`<Maps />`), so the output is idiomatic SDK code.
 */
const ICON_ENTRY: RegistryEntry = {
  name: "Icon",
  importName: "Icon",
  module: "Icon",
  importPath: "@openai/apps-sdk-ui/components/Icon",
  props: [
    {
      name: "name",
      control: "icon",
      required: true,
      description: "Which icon to render",
      typeText: "ComponentType<SVGProps<SVGSVGElement>>",
    },
    {
      name: "className",
      control: "string",
      required: false,
      defaultValue: "size-4",
      description: "Tailwind utility classes",
      typeText: "string",
    },
  ],
  acceptsChildren: false,
  requiresChildren: false,
  category: "Display",
  blurb: `Pick from ${registry.icons.length} icons`,
  isPrimitive: false,
  hidden: false,
  overlay: { category: "Display" },
}

const sdkEntries: RegistryEntry[] = registry.components.map((component) => {
  const overlay = OVERLAY[component.name]
  return {
    ...component,
    category: overlay?.category ?? DEFAULT_CATEGORY,
    blurb: overlay?.blurb,
    isPrimitive: false,
    hidden: overlay?.hidden ?? false,
    overlay,
  }
})

export const ALL_ENTRIES: RegistryEntry[] = [...primitiveEntries, ICON_ENTRY, ...sdkEntries]

const BY_NAME = new Map(ALL_ENTRIES.map((entry) => [entry.name, entry]))

export function getEntry(name: string): RegistryEntry | undefined {
  return BY_NAME.get(name)
}

export function getPrimitive(name: string) {
  return LAYOUT_PRIMITIVES.find((primitive) => primitive.name === name)
}

export const isPrimitive = (name: string) => LAYOUT_PRIMITIVE_NAMES.has(name)
export const isTextualPrimitive = (name: string) => TEXTUAL_PRIMITIVES.has(name)
export const isVoidPrimitive = (name: string) => VOID_PRIMITIVES.has(name)

/* -------------------------------------------------------------------------- */
/* Palette                                                                     */
/* -------------------------------------------------------------------------- */

export type PaletteGroup = { category: Category; entries: RegistryEntry[] }

/**
 * Palette contents, grouped and ordered.
 *
 * Compound parts are omitted from the top level: dropping a bare `Menu.Item`
 * onto the canvas would throw inside Radix. They become available contextually
 * once their parent exists (see `childCandidatesFor`).
 */
export function getPaletteGroups(query = ""): PaletteGroup[] {
  const needle = query.trim().toLowerCase()

  const visible = ALL_ENTRIES.filter((entry) => {
    if (entry.hidden) return false
    if (entry.overlay?.requiresAncestor?.length) return false
    if (!needle) return true
    return (
      entry.name.toLowerCase().includes(needle) ||
      (entry.blurb?.toLowerCase().includes(needle) ?? false)
    )
  })

  return CATEGORY_ORDER.map((category) => ({
    category,
    entries: visible
      .filter((entry) => entry.category === category)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.entries.length > 0)
}

/**
 * Components that may be inserted directly inside `parentName`.
 * Powers the contextual "add child" affordance on the canvas.
 */
export function childCandidatesFor(parentName: string): RegistryEntry[] {
  const parent = getEntry(parentName)
  if (!parent || !parent.acceptsChildren) return []

  const allowed = parent.overlay?.allowedChildren
  if (allowed) {
    return allowed
      .map((name) => getEntry(name))
      .filter((entry): entry is RegistryEntry => Boolean(entry))
  }

  // Anything that isn't a constrained part, plus parts this parent allows.
  return ALL_ENTRIES.filter((entry) => {
    if (entry.hidden) return false
    const requires = entry.overlay?.requiresAncestor
    if (!requires) return true
    return requires.includes(parentName)
  })
}

/**
 * Can `childName` be placed directly inside `parentName`?
 * Enforced on every drop so the canvas cannot be driven into a Radix crash.
 */
export function canContain(parentName: string, childName: string): boolean {
  const parent = getEntry(parentName)
  const child = getEntry(childName)
  if (!parent || !child) return false
  if (!parent.acceptsChildren) return false

  const allowed = parent.overlay?.allowedChildren
  if (allowed) return allowed.includes(childName)

  const requires = child.overlay?.requiresAncestor
  if (requires) return requires.includes(parentName)

  return true
}

/* -------------------------------------------------------------------------- */
/* Node construction                                                           */
/* -------------------------------------------------------------------------- */

let idCounter = 0
export function nextId(): string {
  idCounter += 1
  return `n${Date.now().toString(36)}${idCounter.toString(36)}`
}

function buildStarterChild(spec: StarterChild): UINode {
  const entry = getEntry(spec.component)
  const base = createNode(spec.component, { withStarterChildren: false })

  return {
    ...base,
    props: { ...base.props, ...(spec.props ?? {}) },
    text: spec.text ?? base.text,
    children: spec.children?.map(buildStarterChild) ?? (entry ? base.children : []),
  }
}

/**
 * Create a fresh node for `componentName`, seeded so it renders as something
 * recognisable the moment it lands on the canvas.
 */
export function createNode(
  componentName: string,
  options: { withStarterChildren?: boolean } = {},
): UINode {
  const { withStarterChildren = true } = options
  const entry = getEntry(componentName)

  const props: Record<string, PropValue> = {}

  if (entry?.isPrimitive) {
    const primitive = getPrimitive(componentName)
    if (primitive) props.className = { kind: "literal", value: primitive.defaultClassName }
  }

  // Required props must be present or the component may throw. Seed from the
  // JSDoc default, else the first enum option, else a type-appropriate blank.
  for (const prop of entry?.props ?? []) {
    if (!prop.required) continue
    if (prop.defaultValue !== undefined) {
      props[prop.name] = { kind: "literal", value: prop.defaultValue }
    } else if (prop.control === "enum" && prop.options?.length) {
      props[prop.name] = { kind: "literal", value: prop.options[0] }
    } else if (prop.control === "number") {
      props[prop.name] = { kind: "literal", value: 0 }
    } else if (prop.control === "string") {
      props[prop.name] = { kind: "literal", value: "" }
    }
  }

  Object.assign(props, entry?.overlay?.starterProps ?? {})

  const starterText =
    entry?.overlay?.starterText ??
    (isTextualPrimitive(componentName) ? `${componentName} content` : undefined)

  const children =
    withStarterChildren && entry?.overlay?.starterChildren
      ? entry.overlay.starterChildren.map(buildStarterChild)
      : []

  return {
    id: nextId(),
    component: componentName,
    props,
    children,
    ...(starterText !== undefined && children.length === 0 ? { text: starterText } : {}),
  }
}

export type { Category, ComponentSchema, PropValue, UINode }
export { CATEGORY_ORDER }
