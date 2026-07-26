/**
 * Inspector
 * ---------
 * Renders an editor for the selected node's props.
 *
 * There is no per-component code here: every control is derived from the
 * generated schema's `control` field. Adding a component to the SDK, or a prop
 * to an existing component, requires only re-running the generator.
 */

import { useMemo, useState } from "react"

import { cn } from "../lib/cn"
import { getEntry, ICON_NAMES, isTextualPrimitive, isVoidPrimitive } from "../registry"
import type { PropSchema, PropValue, UINode } from "../registry/types"
import { EmptyState, PanelHeader, Select, TextAreaField, TextField, ToolButton } from "./ui"

type InspectorProps = {
  node: UINode | null
  onChangeProp: (name: string, value: PropValue | undefined) => void
  onChangeText: (text: string) => void
  onDelete: () => void
  onDuplicate: () => void
}

export function Inspector({
  node,
  onChangeProp,
  onChangeText,
  onDelete,
  onDuplicate,
}: InspectorProps) {
  if (!node) {
    return (
      <EmptyState
        className="h-full"
        title="Nothing selected"
        hint="Select a component on the canvas to edit its properties."
      />
    )
  }

  const entry = getEntry(node.component)
  if (!entry) return null

  const editableText =
    (entry.acceptsChildren && node.children.length === 0) || isTextualPrimitive(node.component)

  return (
    <div className="flex h-full flex-col">
      <PanelHeader>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-gray-900">{node.component}</h2>
          {entry.blurb ? (
            <p className="truncate text-xs text-tertiary">{entry.blurb}</p>
          ) : null}
        </div>
        <ToolButton onClick={onDuplicate}>Duplicate</ToolButton>
        <ToolButton variant="danger" onClick={onDelete}>
          Delete
        </ToolButton>
      </PanelHeader>

      <div className="builder-scroll flex-1 overflow-y-auto px-4 py-3">
        {editableText && !isVoidPrimitive(node.component) ? (
          <Field
            label="Content"
            hint="Text rendered inside this component"
          >
            <TextAreaField
              rows={node.component === "Markdown" || node.component === "CodeBlock" ? 5 : 2}
              value={node.text ?? ""}
              onChange={(event) => onChangeText(event.target.value)}
              placeholder="Text content"
            />
          </Field>
        ) : null}

        {entry.props.length === 0 ? (
          <p className="py-4 text-xs text-pretty text-tertiary">
            This component exposes no configurable props.
          </p>
        ) : (
          entry.props.map((schema) => (
            <PropField
              key={schema.name}
              schema={schema}
              value={node.props[schema.name]}
              onChange={(value) => onChangeProp(schema.name, value)}
            />
          ))
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Fields                                                                      */
/* -------------------------------------------------------------------------- */

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <label className="mb-1 flex items-baseline gap-1.5">
        <span className="text-xs font-medium text-secondary">{label}</span>
        {required ? <span className="text-xs text-red-600">required</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-pretty text-tertiary">{hint}</p> : null}
    </div>
  )
}

function PropField({
  schema,
  value,
  onChange,
}: {
  schema: PropSchema
  value: PropValue | undefined
  onChange: (value: PropValue | undefined) => void
}) {
  switch (schema.control) {
    case "enum":
      return <EnumField schema={schema} value={value} onChange={onChange} />
    case "boolean":
      return <BooleanField schema={schema} value={value} onChange={onChange} />
    case "number":
      return <NumberField schema={schema} value={value} onChange={onChange} />
    case "icon":
      return <IconField schema={schema} value={value} onChange={onChange} />
    case "json":
    case "node":
      return <ExpressionField schema={schema} value={value} onChange={onChange} />
    case "string":
    default:
      return <StringField schema={schema} value={value} onChange={onChange} />
  }
}

/** Literal reader helpers — stored values are a tagged union. */
const literal = (value: PropValue | undefined) =>
  value?.kind === "literal" ? value.value : undefined

function EnumField({
  schema,
  value,
  onChange,
}: {
  schema: PropSchema
  value: PropValue | undefined
  onChange: (value: PropValue | undefined) => void
}) {
  const current = literal(value)
  const options = schema.options ?? []

  // A handful of options reads better as a segmented row than a dropdown.
  const asButtons = options.length <= 4 && options.every((option) => option.length <= 8)

  if (asButtons) {
    return (
      <Field label={schema.name} hint={schema.description} required={schema.required}>
        <div className="flex flex-wrap gap-1">
          {!schema.required ? (
            <ChoiceChip
              active={current === undefined}
              label="auto"
              onClick={() => onChange(undefined)}
            />
          ) : null}
          {options.map((option) => (
            <ChoiceChip
              key={option}
              active={String(current) === option}
              label={option}
              onClick={() => onChange(coerceEnum(schema, option))}
            />
          ))}
        </div>
      </Field>
    )
  }

  return (
    <Field label={schema.name} hint={schema.description} required={schema.required}>
      <Select
        className="w-full"
        value={current === undefined ? "" : String(current)}
        onChange={(event) =>
          onChange(event.target.value === "" ? undefined : coerceEnum(schema, event.target.value))
        }
      >
        {!schema.required ? <option value="">— default —</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
            {schema.defaultValue === option ? "  (default)" : ""}
          </option>
        ))}
      </Select>
    </Field>
  )
}

/**
 * A union may mix booleans with strings (`boolean | "indeterminate"`), so the
 * chosen label has to be mapped back to its real JS type before storing.
 */
function coerceEnum(schema: PropSchema, option: string): PropValue {
  const index = schema.options?.indexOf(option) ?? -1
  const raw = index >= 0 ? schema.optionLiterals?.[index] : undefined

  if (raw === "true") return { kind: "literal", value: true }
  if (raw === "false") return { kind: "literal", value: false }
  return { kind: "literal", value: option }
}

function ChoiceChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-2 py-1 text-xs transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500",
        active
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-default text-secondary hover:bg-gray-100 hover:text-gray-900",
      )}
    >
      {label}
    </button>
  )
}

function BooleanField({
  schema,
  value,
  onChange,
}: {
  schema: PropSchema
  value: PropValue | undefined
  onChange: (value: PropValue | undefined) => void
}) {
  const current = literal(value)
  const checked = current === true

  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-secondary">{schema.name}</p>
        {schema.description ? (
          <p className="text-xs text-pretty text-tertiary">{schema.description}</p>
        ) : null}
      </div>
      <input
        type="checkbox"
        aria-label={schema.name}
        className="mt-0.5 size-4 shrink-0 accent-blue-600"
        checked={checked}
        onChange={(event) =>
          onChange(event.target.checked ? { kind: "literal", value: true } : undefined)
        }
      />
    </div>
  )
}

function StringField({
  schema,
  value,
  onChange,
}: {
  schema: PropSchema
  value: PropValue | undefined
  onChange: (value: PropValue | undefined) => void
}) {
  const current = literal(value)

  return (
    <Field label={schema.name} hint={schema.description} required={schema.required}>
      <TextField
        type="text"
        aria-label={schema.name}
        value={current === undefined ? "" : String(current)}
        placeholder={schema.defaultValue !== undefined ? String(schema.defaultValue) : ""}
        onChange={(event) =>
          onChange(
            event.target.value === "" && !schema.required
              ? undefined
              : { kind: "literal", value: event.target.value },
          )
        }
      />
    </Field>
  )
}

function NumberField({
  schema,
  value,
  onChange,
}: {
  schema: PropSchema
  value: PropValue | undefined
  onChange: (value: PropValue | undefined) => void
}) {
  const current = literal(value)

  return (
    <Field label={schema.name} hint={schema.description} required={schema.required}>
      <TextField
        type="number"
        aria-label={schema.name}
        className="tabular-nums"
        value={current === undefined ? "" : Number(current)}
        placeholder={schema.defaultValue !== undefined ? String(schema.defaultValue) : ""}
        onChange={(event) => {
          if (event.target.value === "") return onChange(undefined)
          const parsed = Number(event.target.value)
          onChange(Number.isNaN(parsed) ? undefined : { kind: "literal", value: parsed })
        }}
      />
    </Field>
  )
}

function IconField({
  schema,
  value,
  onChange,
}: {
  schema: PropSchema
  value: PropValue | undefined
  onChange: (value: PropValue | undefined) => void
}) {
  const [query, setQuery] = useState("")
  const current = value?.kind === "icon" ? value.iconName : undefined

  // 745 icons cannot all be rendered; show a filtered window.
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const source = needle
      ? ICON_NAMES.filter((name) => name.toLowerCase().includes(needle))
      : ICON_NAMES
    return source.slice(0, 60)
  }, [query])

  return (
    <Field
      label={schema.name}
      hint={schema.description ?? `${ICON_NAMES.length} icons available`}
      required={schema.required}
    >
      {current ? (
        <div className="mb-1.5 flex items-center gap-2">
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-900">
            {current}
          </code>
          <button
            type="button"
            className="text-xs text-tertiary underline hover:text-secondary"
            onClick={() => onChange(undefined)}
          >
            clear
          </button>
        </div>
      ) : null}
      <TextField
        type="search"
        aria-label={`Search ${schema.name} icons`}
        placeholder="Search icons…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {query ? (
        <div className="builder-scroll mt-1.5 max-h-36 overflow-y-auto rounded-md border border-default">
          {matches.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                onChange({ kind: "icon", iconName: name })
                setQuery("")
              }}
              className="block w-full px-2 py-1 text-left text-xs text-secondary hover:bg-gray-100 hover:text-gray-900"
            >
              {name}
            </button>
          ))}
          {matches.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-tertiary">No matching icons</p>
          ) : null}
        </div>
      ) : null}
    </Field>
  )
}

/**
 * Escape hatch for structured props (`Select.options`) and `ReactNode` slots.
 * The text is emitted verbatim into the exported TSX, so it doubles as a way to
 * reach anything the visual controls cannot express.
 */
function ExpressionField({
  schema,
  value,
  onChange,
}: {
  schema: PropSchema
  value: PropValue | undefined
  onChange: (value: PropValue | undefined) => void
}) {
  const current =
    value?.kind === "expression"
      ? value.code
      : value?.kind === "literal"
        ? JSON.stringify(value.value)
        : ""

  return (
    <Field
      label={schema.name}
      hint={schema.description ? `${schema.description} · ${schema.typeText}` : schema.typeText}
      required={schema.required}
    >
      <TextAreaField
        aria-label={schema.name}
        className="font-mono"
        rows={2}
        spellCheck={false}
        value={current}
        placeholder="JS expression, e.g. [{ value: 'a', label: 'A' }]"
        onChange={(event) =>
          onChange(
            event.target.value.trim() === ""
              ? undefined
              : { kind: "expression", code: event.target.value },
          )
        }
      />
    </Field>
  )
}
