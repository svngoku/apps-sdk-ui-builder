/**
 * Registry overlay
 * ----------------
 * The generated manifest knows every component and prop, but it cannot know:
 *
 *   - **Category** — which drawer of the palette a component belongs in.
 *   - **Composition rules** — that `Menu.Item` is only valid inside
 *     `Menu.Content`, or that `Popover.Trigger` needs a `Popover` ancestor.
 *     Radix throws at runtime if these are violated, so the builder must
 *     prevent the drop rather than let the canvas white-screen.
 *   - **Starter props** — a `Button` with no children renders as an empty pill.
 *     Sensible seed values make a freshly dropped component look like the thing
 *     the user had in mind.
 *   - **Data-driven props** — `Select` takes an `options` array, not children.
 *     No amount of type analysis tells us what a *good* default array is.
 *
 * This file is deliberately small and hand-maintained. Everything mechanical
 * lives in the generated manifest; only genuine editorial judgement lives here.
 */

import type { LayoutPrimitive, PropValue } from "./types"

export type Category =
  | "Layout"
  | "Actions"
  | "Display"
  | "Forms"
  | "Feedback"
  | "Overlays"
  | "Content"

export const CATEGORY_ORDER: Category[] = [
  "Layout",
  "Actions",
  "Forms",
  "Display",
  "Feedback",
  "Overlays",
  "Content",
]

export type OverlayEntry = {
  category: Category
  /** Shown in the palette under the component name. */
  blurb?: string
  /** Seed props applied when the component is first dropped. */
  starterProps?: Record<string, PropValue>
  /** Seed text content for components whose children are plain text. */
  starterText?: string
  /** Child nodes created alongside the component, by registry name. */
  starterChildren?: StarterChild[]
  /**
   * Component names allowed as direct children. When present, the palette and
   * drop targets enforce it. Absent means "any component".
   */
  allowedChildren?: string[]
  /**
   * Registry names of ancestors this component requires. Enforced on drop so
   * Radix never receives an orphaned part.
   */
  requiresAncestor?: string[]
  /** Hide from the palette (still renderable as part of a starter tree). */
  hidden?: boolean
}

export type StarterChild = {
  component: string
  props?: Record<string, PropValue>
  text?: string
  children?: StarterChild[]
}

const lit = (value: string | number | boolean): PropValue => ({ kind: "literal", value })
const expr = (code: string): PropValue => ({ kind: "expression", code })

/* -------------------------------------------------------------------------- */
/* Layout primitives                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The SDK ships no layout components — its own README composes cards from plain
 * `div`s with Tailwind classes. A UI builder without containers could only
 * produce flat lists, so we offer host-element primitives whose classes are
 * seeded from the README's idioms (`rounded-2xl border border-default
 * bg-surface`).
 */
export const LAYOUT_PRIMITIVES: LayoutPrimitive[] = [
  {
    name: "Box",
    label: "Box",
    tag: "div",
    defaultClassName: "p-4",
    description: "Generic container",
  },
  {
    name: "Stack",
    label: "Stack",
    tag: "div",
    defaultClassName: "flex flex-col gap-3",
    description: "Vertical flex layout",
  },
  {
    name: "Row",
    label: "Row",
    tag: "div",
    defaultClassName: "flex items-center gap-3",
    description: "Horizontal flex layout",
  },
  {
    name: "Grid",
    label: "Grid",
    tag: "div",
    defaultClassName: "grid grid-cols-2 gap-3",
    description: "Two-column grid",
  },
  {
    name: "Card",
    label: "Card",
    tag: "div",
    defaultClassName: "w-full rounded-2xl border border-default bg-surface p-4 shadow-lg",
    description: "Surface card, as used in the SDK README",
  },
  {
    name: "Divider",
    label: "Divider",
    tag: "div",
    defaultClassName: "h-px w-full bg-border-default",
    description: "Horizontal rule",
  },
  {
    name: "Spacer",
    label: "Spacer",
    tag: "div",
    defaultClassName: "h-4",
    description: "Fixed vertical space",
  },
  {
    name: "Text",
    label: "Text",
    tag: "p",
    defaultClassName: "text-sm",
    description: "Paragraph text",
  },
  {
    name: "Heading",
    label: "Heading",
    tag: "h2",
    defaultClassName: "heading-lg",
    description: "Section heading",
  },
  {
    name: "Label",
    label: "Label",
    tag: "p",
    defaultClassName: "text-secondary text-sm",
    description: "Secondary caption text",
  },
]

export const LAYOUT_PRIMITIVE_NAMES = new Set(LAYOUT_PRIMITIVES.map((p) => p.name))

/** Layout primitives that hold content vs. those that are self-contained. */
export const TEXTUAL_PRIMITIVES = new Set(["Text", "Heading", "Label"])
export const VOID_PRIMITIVES = new Set(["Divider", "Spacer"])

/* -------------------------------------------------------------------------- */
/* Component overlay                                                           */
/* -------------------------------------------------------------------------- */

export const OVERLAY: Record<string, OverlayEntry> = {
  /* ----------------------------- Actions -------------------------------- */
  Button: {
    category: "Actions",
    blurb: "Primary interactive control",
    starterProps: { color: lit("primary"), variant: lit("solid"), size: lit("md") },
    starterText: "Button",
  },
  ButtonLink: {
    category: "Actions",
    blurb: "Button styled as a link",
    starterProps: { color: lit("primary"), href: lit("#") },
    starterText: "Link button",
  },
  CopyButton: {
    category: "Actions",
    blurb: "Copies a value to the clipboard",
    starterProps: { copyValue: lit("Copied text") },
  },
  TextLink: {
    category: "Actions",
    blurb: "Inline hyperlink",
    starterProps: { href: lit("#") },
    starterText: "Learn more",
  },
  SegmentedControl: {
    category: "Actions",
    blurb: "Mutually exclusive options",
    starterProps: { "aria-label": lit("View"), value: lit("list") },
    starterChildren: [
      { component: "SegmentedControl.Option", props: { value: lit("list") }, text: "List" },
      { component: "SegmentedControl.Option", props: { value: lit("grid") }, text: "Grid" },
    ],
    allowedChildren: ["SegmentedControl.Option"],
  },
  "SegmentedControl.Option": {
    category: "Actions",
    requiresAncestor: ["SegmentedControl"],
    starterProps: { value: lit("option") },
    starterText: "Option",
  },

  /* ------------------------------ Forms --------------------------------- */
  Input: {
    category: "Forms",
    blurb: "Single-line text field",
    starterProps: { placeholder: lit("Enter text") },
  },
  Textarea: {
    category: "Forms",
    blurb: "Multi-line text field",
    starterProps: { placeholder: lit("Enter a longer message") },
  },
  Checkbox: {
    category: "Forms",
    blurb: "Binary or indeterminate toggle",
    starterProps: { label: lit("Checkbox label") },
  },
  Switch: { category: "Forms", blurb: "On/off toggle" },
  Slider: {
    category: "Forms",
    blurb: "Numeric range control",
    starterProps: { min: lit(0), max: lit(100), step: lit(1), value: lit(50) },
  },
  RadioGroup: {
    category: "Forms",
    blurb: "Single choice from a set",
    starterProps: { "aria-label": lit("Choose one") },
    starterChildren: [
      { component: "RadioGroup.Item", props: { value: lit("a") }, text: "Option A" },
      { component: "RadioGroup.Item", props: { value: lit("b") }, text: "Option B" },
    ],
    allowedChildren: ["RadioGroup.Item"],
  },
  "RadioGroup.Item": {
    category: "Forms",
    requiresAncestor: ["RadioGroup"],
    starterProps: { value: lit("option") },
    starterText: "Option",
  },
  Select: {
    category: "Forms",
    blurb: "Dropdown selection",
    // Data-driven rather than composed from children.
    starterProps: {
      options: expr(
        `[{ value: "one", label: "One" }, { value: "two", label: "Two" }]`,
      ),
      value: lit("one"),
    },
  },
  SelectControl: {
    category: "Forms",
    blurb: "Trigger surface used by Select",
    starterText: "Select an option",
  },
  TagInput: {
    category: "Forms",
    blurb: "Token / chip entry field",
    starterProps: { placeholder: lit("Add a tag") },
  },
  DatePicker: {
    category: "Forms",
    blurb: "Single date selection",
    starterProps: { id: lit("date"), triggerDateFormat: lit("DDD") },
  },
  DateRangePicker: {
    category: "Forms",
    blurb: "Start and end date selection",
  },

  /* ----------------------------- Display -------------------------------- */
  Badge: {
    category: "Display",
    blurb: "Compact status label",
    starterProps: { color: lit("success"), variant: lit("soft") },
    starterText: "Badge",
  },
  Avatar: {
    category: "Display",
    blurb: "User or entity image",
    starterProps: { name: lit("Ada Lovelace") },
  },
  AvatarGroup: {
    category: "Display",
    blurb: "Overlapping avatar cluster",
    starterChildren: [
      { component: "Avatar", props: { name: lit("Ada") } },
      { component: "Avatar", props: { name: lit("Grace") } },
    ],
    allowedChildren: ["Avatar"],
  },
  Image: {
    category: "Display",
    blurb: "Image with loading treatment",
    starterProps: {
      src: lit("https://placehold.co/600x400/png"),
      alt: lit("Placeholder"),
    },
  },

  /* ---------------------------- Feedback -------------------------------- */
  Alert: {
    category: "Feedback",
    blurb: "Inline status message",
    starterProps: {
      color: lit("info"),
      variant: lit("soft"),
      title: lit("Heads up"),
      description: lit("Something worth noticing happened."),
    },
  },
  EmptyMessage: {
    category: "Feedback",
    blurb: "Empty-state placeholder",
    starterChildren: [
      { component: "EmptyMessage.Title", text: "Nothing here yet" },
      { component: "EmptyMessage.Description", text: "Items you add will appear in this space." },
    ],
    allowedChildren: [
      "EmptyMessage.Icon",
      "EmptyMessage.Title",
      "EmptyMessage.Description",
      "EmptyMessage.ActionRow",
    ],
  },
  "EmptyMessage.Title": {
    category: "Feedback",
    requiresAncestor: ["EmptyMessage"],
    starterText: "Nothing here yet",
  },
  "EmptyMessage.Description": {
    category: "Feedback",
    requiresAncestor: ["EmptyMessage"],
    starterText: "Describe what the user can do next.",
  },
  "EmptyMessage.Icon": { category: "Feedback", requiresAncestor: ["EmptyMessage"] },
  "EmptyMessage.ActionRow": {
    category: "Feedback",
    requiresAncestor: ["EmptyMessage"],
    starterChildren: [
      { component: "Button", props: { color: lit("primary") }, text: "Get started" },
    ],
  },
  LoadingIndicator: { category: "Feedback", blurb: "Spinner for pending work" },
  LoadingDots: { category: "Feedback", blurb: "Animated ellipsis" },
  CircularProgress: {
    category: "Feedback",
    blurb: "Determinate progress ring",
    starterProps: { value: lit(60) },
  },
  ShimmerText: {
    category: "Feedback",
    blurb: "Skeleton text while streaming",
    starterText: "Loading content",
  },
  ShimmerableText: {
    category: "Feedback",
    blurb: "Text that can shimmer conditionally",
    starterText: "Streaming text",
  },

  /* ---------------------------- Overlays -------------------------------- */
  Tooltip: {
    category: "Overlays",
    blurb: "Hover hint",
    hidden: true,
  },
  "Tooltip.Root": {
    category: "Overlays",
    blurb: "Tooltip wrapper",
    starterChildren: [
      {
        component: "Tooltip.Trigger",
        children: [{ component: "Button", props: { color: lit("secondary") }, text: "Hover me" }],
      },
      { component: "Tooltip.Content", text: "Helpful hint" },
    ],
    allowedChildren: ["Tooltip.Trigger", "Tooltip.Content", "Tooltip.TriggerDecorator"],
  },
  "Tooltip.Trigger": { category: "Overlays", requiresAncestor: ["Tooltip.Root"] },
  "Tooltip.Content": {
    category: "Overlays",
    requiresAncestor: ["Tooltip.Root"],
    starterText: "Helpful hint",
  },
  "Tooltip.TriggerDecorator": { category: "Overlays", requiresAncestor: ["Tooltip.Root"] },

  Popover: {
    category: "Overlays",
    blurb: "Anchored floating panel",
    starterChildren: [
      {
        component: "Popover.Trigger",
        children: [{ component: "Button", props: { color: lit("secondary") }, text: "Open" }],
      },
      {
        component: "Popover.Content",
        children: [{ component: "Text", text: "Popover content" }],
      },
    ],
    allowedChildren: ["Popover.Trigger", "Popover.Content"],
  },
  "Popover.Trigger": { category: "Overlays", requiresAncestor: ["Popover"] },
  "Popover.Content": {
    category: "Overlays",
    requiresAncestor: ["Popover"],
    starterChildren: [{ component: "Text", text: "Popover content" }],
  },

  Menu: {
    category: "Overlays",
    blurb: "Dropdown menu",
    starterChildren: [
      {
        component: "Menu.Trigger",
        children: [{ component: "Button", props: { color: lit("secondary") }, text: "Menu" }],
      },
      {
        component: "Menu.Content",
        children: [
          { component: "Menu.Item", text: "First action" },
          { component: "Menu.Item", text: "Second action" },
        ],
      },
    ],
    allowedChildren: ["Menu.Trigger", "Menu.Content"],
  },
  "Menu.Trigger": { category: "Overlays", requiresAncestor: ["Menu"] },
  "Menu.Content": {
    category: "Overlays",
    requiresAncestor: ["Menu"],
    starterChildren: [{ component: "Menu.Item", text: "Action" }],
    allowedChildren: [
      "Menu.Item",
      "Menu.Link",
      "Menu.Separator",
      "Menu.CheckboxItem",
      "Menu.RadioGroup",
      "Menu.Sub",
      "Menu.ItemActions",
    ],
  },
  "Menu.Item": {
    category: "Overlays",
    requiresAncestor: ["Menu.Content", "Menu.SubContent"],
    starterText: "Action",
  },
  "Menu.Link": {
    category: "Overlays",
    requiresAncestor: ["Menu.Content", "Menu.SubContent"],
    starterProps: { href: lit("#") },
    starterText: "Link",
  },
  "Menu.Separator": {
    category: "Overlays",
    requiresAncestor: ["Menu.Content", "Menu.SubContent"],
  },
  "Menu.CheckboxItem": {
    category: "Overlays",
    requiresAncestor: ["Menu.Content", "Menu.SubContent"],
    starterText: "Toggle",
  },
  "Menu.RadioGroup": {
    category: "Overlays",
    requiresAncestor: ["Menu.Content", "Menu.SubContent"],
    allowedChildren: ["Menu.RadioItem"],
    starterChildren: [{ component: "Menu.RadioItem", props: { value: lit("a") }, text: "Choice" }],
  },
  "Menu.RadioItem": {
    category: "Overlays",
    requiresAncestor: ["Menu.RadioGroup"],
    starterProps: { value: lit("a") },
    starterText: "Choice",
  },
  "Menu.Sub": {
    category: "Overlays",
    requiresAncestor: ["Menu.Content"],
    allowedChildren: ["Menu.SubTrigger", "Menu.SubContent"],
    starterChildren: [
      { component: "Menu.SubTrigger", text: "More" },
      { component: "Menu.SubContent", children: [{ component: "Menu.Item", text: "Nested" }] },
    ],
  },
  "Menu.SubTrigger": {
    category: "Overlays",
    requiresAncestor: ["Menu.Sub"],
    starterText: "More",
  },
  "Menu.SubContent": {
    category: "Overlays",
    requiresAncestor: ["Menu.Sub"],
    allowedChildren: ["Menu.Item", "Menu.Link", "Menu.Separator"],
    starterChildren: [{ component: "Menu.Item", text: "Nested action" }],
  },
  "Menu.ItemActions": { category: "Overlays", requiresAncestor: ["Menu.Item"], hidden: true },
  "Menu.ItemAction": { category: "Overlays", requiresAncestor: ["Menu.ItemActions"], hidden: true },

  /* ----------------------------- Content -------------------------------- */
  Markdown: {
    category: "Content",
    blurb: "Renders markdown content",
    starterText: "# Heading\n\nMarkdown **content** with a [link](#).",
  },
  CodeBlock: {
    category: "Content",
    blurb: "Syntax-highlighted code",
    starterProps: { language: lit("tsx") },
    starterText: "const greeting = 'hello world'",
  },
  CodeBlockBase: { category: "Content", hidden: true },
  "CodeBlockBase.Code": { category: "Content", hidden: true },
  "CodeBlockBase.CopyButton": { category: "Content", hidden: true },
  CopyTooltip: { category: "Content", hidden: true },

  /* ---- Infrastructure: real components, but not things you compose with -- */
  AppsSDKUIProvider: { category: "Layout", hidden: true },
  Animate: { category: "Layout", hidden: true },
  AnimateLayout: { category: "Layout", hidden: true },
  AnimateLayoutGroup: { category: "Layout", hidden: true },
  TransitionGroup: { category: "Layout", hidden: true },
  SlotTransitionGroup: { category: "Layout", hidden: true },
}

/** Components with no overlay entry still appear, in this fallback category. */
export const DEFAULT_CATEGORY: Category = "Display"
