/**
 * Shared registry types.
 *
 * `ControlKind` and the schema shapes mirror what `scripts/generate-registry.mts`
 * emits. Keeping them in one place means a change to the generator surfaces as a
 * type error here rather than as a runtime surprise in the inspector.
 */

export type ControlKind =
  | "enum"
  | "boolean"
  | "string"
  | "number"
  | "icon"
  | "node"
  /**
   * A *required* event callback (e.g. `Slider.onChange`). Not form-editable,
   * but it cannot be dropped either: omitting it produces exported code that
   * does not type-check. The exporter emits a no-op stub for these.
   */
  | "handler"
  | "json"

export type PropSchema = {
  name: string
  control: ControlKind
  options?: string[]
  optionLiterals?: string[]
  required: boolean
  defaultValue?: string | boolean | number
  description?: string
  typeText: string
}

export type ComponentSchema = {
  name: string
  importName: string
  module: string
  importPath: string
  parent?: string
  props: PropSchema[]
  acceptsChildren: boolean
  requiresChildren: boolean
}

export type GeneratedRegistry = {
  sdkVersion: string
  componentCount: number
  iconCount: number
  components: ComponentSchema[]
  icons: string[]
}

/* -------------------------------------------------------------------------- */
/* Document model                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A prop value in the document tree.
 *
 * Everything is stored as a discriminated union rather than a raw `unknown` so
 * that the exporter can emit correct JSX without re-deriving intent:
 * `{ kind: "literal", value: "solid" }` becomes `variant="solid"`, while
 * `{ kind: "expression", code: "{ a: 1 }" }` becomes `prop={{ a: 1 }}`.
 */
export type PropValue =
  | { kind: "literal"; value: string | number | boolean }
  | { kind: "icon"; iconName: string }
  | { kind: "expression"; code: string }

/** A node in the composed UI tree. */
export type UINode = {
  id: string
  /** Registry component name, e.g. `Button` or `Menu.Item`. */
  component: string
  props: Record<string, PropValue>
  children: UINode[]
  /**
   * Text content, used when a component's children are plain text rather than
   * nested components. Mutually exclusive with `children` in practice.
   */
  text?: string
}

/**
 * A primitive host element the builder offers for layout scaffolding.
 *
 * `tag` is a plain string union rather than `keyof JSX.IntrinsicElements`:
 * React 19 moved the JSX namespace under `React.JSX`, and the exporter needs a
 * value it can concatenate into a tag name without symbol-key ambiguity.
 */
export type HostTag = "div" | "span" | "p" | "h1" | "h2" | "h3" | "section" | "hr"

export type LayoutPrimitive = {
  name: string
  label: string
  tag: HostTag
  defaultClassName: string
  description: string
}
