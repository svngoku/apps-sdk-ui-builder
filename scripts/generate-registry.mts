/**
 * Registry generator
 * ------------------
 * Parses the type definitions shipped inside `@openai/apps-sdk-ui` and emits a
 * JSON manifest describing every exported component, its compound parts, and
 * its props.
 *
 * Why generate instead of hand-authoring:
 *   The package ships richly JSDoc'd `.d.ts` files where nearly every prop is a
 *   literal union (`"solid" | "soft" | ...`), a boolean, or a string, and carries
 *   both a description and an `@default` tag. That is already a machine-readable
 *   spec for a property inspector. Hand-maintaining ~40 component schemas would
 *   duplicate it and silently drift the first time the SDK is upgraded.
 *
 * Three shapes need special handling, all discovered by reading the real types:
 *   1. `Icon` exports 745 SVG components. Those are values for an icon *picker*,
 *      not 745 palette entries, so they go in a separate `icons` list.
 *   2. Compound components (`Menu.Item`, `Menu.Content`, ...) are static
 *      properties hung off a function object, so they need a second pass over
 *      the parent's properties.
 *   3. Props typed `ComponentType<SVGProps<SVGSVGElement>>` are icon slots and
 *      get a dedicated control backed by the icon list from (1).
 *
 * Run with:  npm run generate:registry
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, "..")
const SDK_ROOT = join(PROJECT_ROOT, "node_modules", "@openai", "apps-sdk-ui")
const TYPES_ROOT = join(SDK_ROOT, "dist", "types")
const COMPONENTS_ROOT = join(TYPES_ROOT, "components")
const OUT_FILE = join(PROJECT_ROOT, "src", "registry", "registry.generated.json")

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/** How the inspector should render an editor for a prop. */
type ControlKind =
  | "enum" // closed set of literals -> select / segmented control
  | "boolean" // -> switch
  | "string" // -> text input
  | "number" // -> number input
  | "icon" // ComponentType<SVGProps<SVGSVGElement>> -> icon picker
  | "node" // ReactNode slot -> managed as child nodes on the canvas
  | "handler" // REQUIRED event callback -> exported as a stub so code compiles
  | "json" // structured value -> raw JSON escape hatch

type PropSchema = {
  name: string
  control: ControlKind
  /** Display labels for `enum` options. */
  options?: string[]
  /**
   * Raw JS literal for each option, parallel to `options`. Needed because a
   * union may mix strings with booleans (`boolean | "indeterminate"`), and the
   * exporter must emit `checked` vs `checked="indeterminate"` correctly.
   */
  optionLiterals?: string[]
  required: boolean
  /** Parsed from the `@default` JSDoc tag when present. */
  defaultValue?: string | boolean | number
  description?: string
  /** The raw printed type, retained for tooltips and the escape hatch. */
  typeText: string
}

type ComponentSchema = {
  /** Reference used in JSX, e.g. `Button` or `Menu.Item`. */
  name: string
  /** Binding that must be imported, e.g. `Menu` for `Menu.Item`. */
  importName: string
  /** Subpath directory, e.g. `Button`. */
  module: string
  /** Full import specifier. */
  importPath: string
  /** Present on compound parts; the parent component's name. */
  parent?: string
  props: PropSchema[]
  /** True when the component accepts `children`. */
  acceptsChildren: boolean
  /** True when `children` is a required prop. */
  requiresChildren: boolean
}

/* -------------------------------------------------------------------------- */
/* Heuristics                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Props inherited from DOM typings (`ButtonHTMLAttributes`, etc.) number in the
 * hundreds and would drown the inspector. We keep only props declared by the SDK
 * itself, plus a small allowlist of genuinely useful DOM passthroughs.
 */
const DOM_PASSTHROUGH_ALLOWLIST = new Set([
  "className",
  "id",
  "placeholder",
  "href",
  "to",
  "type",
  "name",
  "title",
  "alt",
  "src",
  "rows",
  "maxLength",
  "readOnly",
  "required",
  "autoFocus",
  "target",
  "rel",
])

/** Never surface these — internal, ref plumbing, or handled structurally. */
const EXCLUDED_PROPS = new Set([
  "ref",
  "key",
  "asChild",
  "css",
  "style",
  "dangerouslySetInnerHTML",
  "children",
])

/** Function-object members that exist on every function, not compound parts. */
const FUNCTION_INTRINSICS = new Set([
  "apply",
  "call",
  "bind",
  "toString",
  "length",
  "name",
  "prototype",
  "caller",
  "arguments",
  "displayName",
  "propTypes",
  "defaultProps",
  "contextTypes",
  "$$typeof",
  "render",
])

function isEventProp(name: string): boolean {
  return /^on[A-Z]/.test(name)
}

/** Is this declaration from the SDK's own source rather than React/DOM libs? */
function isSdkDeclaration(decl: ts.Declaration): boolean {
  const file = decl.getSourceFile().fileName
  return file.includes("apps-sdk-ui")
}

function isReactNodeLike(typeText: string): boolean {
  return /\bReact(Node|Element)\b|\bJSX\.Element\b/.test(typeText)
}

/** `ComponentType<SVGProps<SVGSVGElement>>` and friends -> icon picker. */
function isIconSlot(typeText: string): boolean {
  return /SVGProps<SVGSVGElement>/.test(typeText)
}

/* -------------------------------------------------------------------------- */
/* Type -> control mapping                                                     */
/* -------------------------------------------------------------------------- */

type Described = {
  control: ControlKind
  options?: string[]
  optionLiterals?: string[]
  typeText: string
}

/**
 * Collapse a TypeScript type into an inspector control.
 *
 * The interesting case is unions. The SDK's scale aliases (`ControlSize`,
 * `Variants<...>`, `SemanticColors<...>`) are generic aliases over string
 * literal unions, and the checker resolves them for us — so `size?: ControlSize`
 * arrives here already expanded to nine string literals.
 */
function describeType(type: ts.Type, checker: ts.TypeChecker): Described {
  const typeText = checker.typeToString(type)

  if (isIconSlot(typeText)) return { control: "icon", typeText }

  // Strip null/undefined so optionality doesn't pollute the union analysis.
  const nonNullable = type.getNonNullableType()

  if (nonNullable.flags & ts.TypeFlags.BooleanLike) {
    return { control: "boolean", typeText }
  }

  if (nonNullable.isUnion()) {
    const parts = nonNullable.types.filter(
      (t) => !(t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)),
    )

    // `boolean` is internally a union of `true | false`.
    if (parts.every((t) => t.flags & ts.TypeFlags.BooleanLike)) {
      return { control: "boolean", typeText }
    }

    const stringLiterals = parts.filter((t) => t.isStringLiteral())
    const booleanParts = parts.filter((t) => t.flags & ts.TypeFlags.BooleanLike)
    const accountedFor = stringLiterals.length + booleanParts.length

    // A union made purely of literals is an enum. Booleans are folded in so
    // that `boolean | "indeterminate"` stays selectable rather than falling
    // through to a JSON editor.
    if (stringLiterals.length > 0 && accountedFor === parts.length) {
      const options: string[] = []
      const optionLiterals: string[] = []

      if (booleanParts.length > 0) {
        options.push("true", "false")
        optionLiterals.push("true", "false")
      }
      for (const literal of stringLiterals) {
        const value = (literal as ts.StringLiteralType).value
        options.push(value)
        optionLiterals.push(JSON.stringify(value))
      }
      return { control: "enum", options, optionLiterals, typeText }
    }

    if (parts.some((t) => isReactNodeLike(checker.typeToString(t)))) {
      return { control: "node", typeText }
    }

    // `string | number` (e.g. CSS-ish sizes) is best edited as free text.
    if (parts.every((t) => t.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike))) {
      const allNumeric = parts.every((t) => t.flags & ts.TypeFlags.NumberLike)
      return { control: allNumeric ? "number" : "string", typeText }
    }

    return { control: "json", typeText }
  }

  if (nonNullable.isStringLiteral()) {
    return {
      control: "enum",
      options: [nonNullable.value],
      optionLiterals: [JSON.stringify(nonNullable.value)],
      typeText,
    }
  }

  if (nonNullable.flags & ts.TypeFlags.StringLike) return { control: "string", typeText }
  if (nonNullable.flags & ts.TypeFlags.NumberLike) return { control: "number", typeText }
  if (isReactNodeLike(typeText)) return { control: "node", typeText }

  return { control: "json", typeText }
}

/* -------------------------------------------------------------------------- */
/* JSDoc extraction                                                            */
/* -------------------------------------------------------------------------- */

function getDescription(symbol: ts.Symbol, checker: ts.TypeChecker): string | undefined {
  const text = ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim()
  if (!text) return undefined
  // JSDoc here sometimes embeds wide markdown sizing tables. Keep the prose.
  const prose = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("|"))
  return prose[0] || undefined
}

/** Parse `@default md` / `@default "solid"` / `@default false`. */
function getDefaultValue(symbol: ts.Symbol): string | boolean | number | undefined {
  const tag = symbol.getJsDocTags().find((t) => t.name === "default")
  if (!tag) return undefined

  const raw = ts.displayPartsToString(tag.text).trim()
  if (!raw) return undefined

  const unquoted = raw.replace(/^["'`]|["'`]$/g, "")
  if (unquoted === "true") return true
  if (unquoted === "false") return false
  if (unquoted !== "" && !Number.isNaN(Number(unquoted))) return Number(unquoted)
  return unquoted
}

/* -------------------------------------------------------------------------- */
/* Component extraction                                                        */
/* -------------------------------------------------------------------------- */

type ExtractedProps = {
  props: PropSchema[]
  acceptsChildren: boolean
  requiresChildren: boolean
}

function extractProps(
  signature: ts.Signature,
  checker: ts.TypeChecker,
  fallbackDecl: ts.Declaration,
): ExtractedProps {
  const propsParam = signature.getParameters()[0]
  if (!propsParam) return { props: [], acceptsChildren: false, requiresChildren: false }

  const propsDecl = propsParam.valueDeclaration ?? propsParam.declarations?.[0] ?? fallbackDecl
  const propsType = checker.getTypeOfSymbolAtLocation(propsParam, propsDecl)

  const props: PropSchema[] = []
  let acceptsChildren = false
  let requiresChildren = false

  for (const prop of propsType.getProperties()) {
    const propName = prop.getName()

    if (propName === "children") {
      acceptsChildren = true
      requiresChildren = !(prop.flags & ts.SymbolFlags.Optional)
      continue
    }
    if (EXCLUDED_PROPS.has(propName)) continue

    const declarations = prop.declarations ?? []
    const declaredBySdk = declarations.some(isSdkDeclaration)
    if (!declaredBySdk && !DOM_PASSTHROUGH_ALLOWLIST.has(propName)) continue

    const isRequired = !(prop.flags & ts.SymbolFlags.Optional)

    // Optional event handlers are not form-editable, so they are dropped.
    // REQUIRED ones cannot be: omitting `Slider.onChange` produces exported
    // code that does not compile. Those are kept and emitted as no-op stubs.
    if (isEventProp(propName) && !isRequired) continue

    const propDecl = prop.valueDeclaration ?? declarations[0]
    if (!propDecl) continue

    const propType = checker.getTypeOfSymbolAtLocation(prop, propDecl)
    const described = isEventProp(propName)
      ? ({ control: "handler", typeText: checker.typeToString(propType) } satisfies Described)
      : describeType(propType, checker)

    // A DOM passthrough that we could not narrow is noise (e.g. Button
    // inheriting `value: string | number | readonly string[]`). SDK-declared
    // props keep their JSON escape hatch because they are genuinely meaningful.
    if (!declaredBySdk && (described.control === "json" || described.control === "node")) continue

    const defaultValue = getDefaultValue(prop)
    const description = getDescription(prop, checker)

    props.push({
      name: propName,
      control: described.control,
      ...(described.options ? { options: described.options } : {}),
      ...(described.optionLiterals ? { optionLiterals: described.optionLiterals } : {}),
      required: isRequired,
      ...(defaultValue !== undefined ? { defaultValue } : {}),
      ...(description ? { description } : {}),
      typeText: described.typeText,
    })
  }

  props.sort((a, b) => {
    // Required first, then the interesting visual knobs, then the long tail.
    if (a.required !== b.required) return a.required ? -1 : 1
    const rank = (c: ControlKind) =>
      c === "enum"
        ? 0
        : c === "boolean"
          ? 1
          : c === "icon"
            ? 2
            : c === "json"
              ? 4
              : c === "handler"
                ? 5
                : 3
    if (rank(a.control) !== rank(b.control)) return rank(a.control) - rank(b.control)
    return a.name.localeCompare(b.name)
  })

  return { props, acceptsChildren, requiresChildren }
}

/** Pick the call signature that actually receives props. */
function primarySignature(type: ts.Type): ts.Signature | undefined {
  const signatures = type.getCallSignatures()
  if (signatures.length === 0) return undefined
  return signatures.find((s) => s.getParameters().length > 0) ?? signatures[0]
}

function main() {
  if (!existsSync(COMPONENTS_ROOT)) {
    console.error(`Could not find SDK types at ${COMPONENTS_ROOT}.`)
    console.error("Is @openai/apps-sdk-ui installed?")
    process.exit(1)
  }

  const componentDirs = ts.sys
    .getDirectories(COMPONENTS_ROOT)
    .filter((dir) => existsSync(join(COMPONENTS_ROOT, dir, "index.d.ts")))
    .sort()

  const entryFiles = componentDirs.map((dir) => join(COMPONENTS_ROOT, dir, "index.d.ts"))

  const program = ts.createProgram(entryFiles, {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
  })
  const checker = program.getTypeChecker()

  const components: ComponentSchema[] = []
  const icons: string[] = []

  for (const dir of componentDirs) {
    const source = program.getSourceFile(join(COMPONENTS_ROOT, dir, "index.d.ts"))
    if (!source) continue

    const moduleSymbol = checker.getSymbolAtLocation(source)
    if (!moduleSymbol) continue

    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      const name = exported.getName()

      // Components are PascalCase; `type FooProps` exports and hooks are not
      // palette entries.
      if (!/^[A-Z]/.test(name) || name.endsWith("Props")) continue

      // The Icon module is 745 SVG components — a value set for a picker,
      // not 745 palette entries.
      if (dir === "Icon") {
        icons.push(name)
        continue
      }

      const resolved =
        exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
      const decl = resolved.valueDeclaration ?? resolved.declarations?.[0]
      if (!decl) continue

      const type = checker.getTypeOfSymbolAtLocation(resolved, decl)
      const signature = primarySignature(type)
      if (!signature) continue // not a component

      const { props, acceptsChildren, requiresChildren } = extractProps(signature, checker, decl)

      components.push({
        name,
        importName: name,
        module: dir,
        importPath: `@openai/apps-sdk-ui/components/${dir}`,
        props,
        acceptsChildren,
        requiresChildren,
      })

      // Second pass: compound parts hung off the function object
      // (`Menu.Item`, `Menu.Content`, ...).
      for (const member of type.getProperties()) {
        const memberName = member.getName()
        if (FUNCTION_INTRINSICS.has(memberName)) continue
        if (!/^[A-Z]/.test(memberName)) continue

        const memberDecl = member.valueDeclaration ?? member.declarations?.[0]
        if (!memberDecl || !isSdkDeclaration(memberDecl)) continue

        const memberType = checker.getTypeOfSymbolAtLocation(member, memberDecl)
        const memberSignature = primarySignature(memberType)
        if (!memberSignature) continue

        const extracted = extractProps(memberSignature, checker, memberDecl)

        components.push({
          name: `${name}.${memberName}`,
          importName: name,
          module: dir,
          importPath: `@openai/apps-sdk-ui/components/${dir}`,
          parent: name,
          props: extracted.props,
          acceptsChildren: extracted.acceptsChildren,
          requiresChildren: extracted.requiresChildren,
        })
      }
    }
  }

  components.sort((a, b) => a.name.localeCompare(b.name))
  icons.sort()

  const sdkVersion = JSON.parse(ts.sys.readFile(join(SDK_ROOT, "package.json")) ?? "{}")
    .version as string

  const manifest = {
    $comment:
      "GENERATED FILE - do not edit. Run `npm run generate:registry` to rebuild from the installed SDK types.",
    sdkVersion,
    generatedFrom: "@openai/apps-sdk-ui/dist/types",
    componentCount: components.length,
    iconCount: icons.length,
    components,
    icons,
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + "\n", "utf8")

  /* ----------------------------- Report ---------------------------------- */
  const tally = (kind: ControlKind) =>
    components.reduce((n, c) => n + c.props.filter((p) => p.control === kind).length, 0)
  const totalProps = components.reduce((n, c) => n + c.props.length, 0)

  console.log(`Apps SDK UI v${sdkVersion}`)
  console.log(`  components : ${components.length} (${components.filter((c) => c.parent).length} compound parts)`)
  console.log(`  icons      : ${icons.length}`)
  console.log(
    `  props      : ${totalProps}  [enum ${tally("enum")}, bool ${tally("boolean")}, ` +
      `string ${tally("string")}, number ${tally("number")}, icon ${tally("icon")}, ` +
      `node ${tally("node")}, json ${tally("json")}, handler ${tally("handler")}]`,
  )
  console.log(`  written to : ${OUT_FILE.replace(PROJECT_ROOT + "/", "")}`)
}

main()
