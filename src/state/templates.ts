/**
 * Starter templates
 * -----------------
 * Pre-composed documents that demonstrate what the builder can express, and
 * give a new user something to take apart rather than a blank canvas.
 *
 * The reservation card is deliberately a faithful reconstruction of the example
 * in the Apps SDK UI README: if the builder's model can express that example
 * exactly, the model is expressive enough for real ChatGPT app surfaces.
 */

import { createNode } from "../registry"
import type { PropValue, UINode } from "../registry/types"
import type { UIDocument } from "./document"

const lit = (value: string | number | boolean): PropValue => ({ kind: "literal", value })
const icon = (iconName: string): PropValue => ({ kind: "icon", iconName })

/**
 * Build a node without its starter children, then apply overrides.
 *
 * Text and element children are mutually exclusive: `createNode` seeds a
 * starter string for components like `Button`, which must be cleared when the
 * template supplies real children instead.
 */
function node(
  component: string,
  props: Record<string, PropValue> = {},
  children: UINode[] = [],
  text?: string,
): UINode {
  const base = createNode(component, { withStarterChildren: false })
  const resolvedText = text !== undefined ? text : children.length > 0 ? undefined : base.text

  return {
    ...base,
    props: { ...base.props, ...props },
    children,
    ...(resolvedText !== undefined ? { text: resolvedText } : {}),
  }
}

export type Template = {
  name: string
  description: string
  build: () => UIDocument
}

export const STARTER_TEMPLATES: Template[] = [
  {
    name: "Reservation card",
    description: "The example from the Apps SDK UI README",
    build: () => ({
      root: [
        node(
          "Card",
          { className: lit("w-full max-w-sm rounded-2xl border border-default bg-surface p-4 shadow-lg") },
          [
            node("Row", { className: lit("flex items-start justify-between gap-3") }, [
              node("Stack", { className: lit("flex flex-col") }, [
                node("Label", { className: lit("text-secondary text-sm") }, [], "Reservation"),
                node("Heading", { className: lit("mt-1 heading-lg") }, [], "La Luna Bistro"),
              ]),
              node("Badge", { color: lit("success") }, [], "Confirmed"),
            ]),
            node(
              "Row",
              { className: lit("mt-4 flex items-center justify-between text-sm") },
              [
                node("Row", { className: lit("flex items-center gap-1.5 font-medium text-secondary") }, [], "Date"),
                node("Text", { className: lit("text-right") }, [], "Apr 12 · 7:30 PM"),
              ],
            ),
            node(
              "Row",
              { className: lit("mt-2 flex items-center justify-between text-sm") },
              [
                node("Row", { className: lit("flex items-center gap-1.5 font-medium text-secondary") }, [], "Guests"),
                node("Text", { className: lit("text-right") }, [], "Party of 2"),
              ],
            ),
            node(
              "Grid",
              { className: lit("mt-4 grid gap-3 border-t border-subtle pt-4 sm:grid-cols-2") },
              [
                node("Button", { variant: lit("soft"), color: lit("secondary"), block: lit(true) }, [], "Call"),
                node("Button", { color: lit("primary"), block: lit(true) }, [], "Directions"),
              ],
            ),
          ],
        ),
      ],
    }),
  },

  {
    name: "Settings panel",
    description: "Form controls in a surface card",
    build: () => ({
      root: [
        node(
          "Card",
          { className: lit("w-full max-w-md rounded-2xl border border-default bg-surface p-5 shadow-lg") },
          [
            node("Heading", { className: lit("heading-lg") }, [], "Preferences"),
            node("Label", { className: lit("text-secondary mt-1 text-sm") }, [], "Configure how the app behaves."),
            node("Stack", { className: lit("mt-5 flex flex-col gap-4") }, [
              node("Input", { placeholder: lit("Display name") }),
              node("Textarea", { placeholder: lit("Short bio") }),
              node("Checkbox", { label: lit("Enable notifications") }),
              node("Slider", { min: lit(0), max: lit(100), step: lit(5), value: lit(40), label: lit("Volume") }),
            ]),
            node("Row", { className: lit("mt-5 flex justify-end gap-2") }, [
              node("Button", { variant: lit("ghost"), color: lit("secondary") }, [], "Cancel"),
              node("Button", { color: lit("primary") }, [], "Save changes"),
            ]),
          ],
        ),
      ],
    }),
  },

  {
    name: "Status feed",
    description: "Alerts, badges, and an empty state",
    build: () => ({
      root: [
        node("Stack", { className: lit("flex w-full max-w-lg flex-col gap-4") }, [
          node("Alert", {
            color: lit("success"),
            variant: lit("soft"),
            title: lit("Deployment complete"),
            description: lit("Version 2.4.0 is live in production."),
          }),
          node("Alert", {
            color: lit("caution"),
            variant: lit("soft"),
            title: lit("Quota at 80%"),
            description: lit("Consider upgrading before the end of the cycle."),
          }),
          node(
            "Card",
            { className: lit("rounded-2xl border border-default bg-surface p-6") },
            [
              node("EmptyMessage", {}, [
                node("EmptyMessage.Title", {}, [], "No incidents"),
                node("EmptyMessage.Description", {}, [], "Everything has been stable for 30 days."),
              ]),
            ],
          ),
        ]),
      ],
    }),
  },

  {
    name: "Icon + label buttons",
    description: "Icons composed as children, per the SDK README",
    build: () => ({
      root: [
        node("Row", { className: lit("flex flex-wrap items-center gap-2") }, [
          node("Button", { color: lit("primary") }, [
            node("Icon", { name: icon("Maps") }),
            node("Text", { className: lit("") }, [], "Directions"),
          ]),
          node("Button", { color: lit("secondary"), variant: lit("soft") }, [
            node("Icon", { name: icon("Phone") }),
            node("Text", { className: lit("") }, [], "Call"),
          ]),
          node("Button", { color: lit("secondary"), variant: lit("outline") }, [
            node("Icon", { name: icon("Calendar") }),
            node("Text", { className: lit("") }, [], "Schedule"),
          ]),
        ]),
      ],
    }),
  },
]
