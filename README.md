# Apps SDK UI Builder

A visual UI builder for [`@openai/apps-sdk-ui`](https://github.com/openai/apps-sdk-ui) — compose
ChatGPT app interfaces from the SDK's primitives, preview them live, and export clean TSX.

![Builder interface](./docs/screenshot.jpg)

```bash
npm install
npm run dev
```

---

## What it does

- **Palette** — every component the SDK exposes, grouped and searchable.
- **Canvas** — renders the *real* components, so the preview is the output.
- **Inspector** — prop controls generated from the SDK's own type definitions.
- **Code panel** — live TSX with correct imports; copy or download.
- Drag-and-drop, undo/redo, layer tree, dark mode, responsive widths, local autosave,
  and JSON import/export.

---

## The central idea: the registry is generated, not written

The obvious way to build this is to hand-write a schema for each component — its props, their
allowed values, their defaults. That is somewhere around 500 prop definitions, and every one of
them silently rots the moment the SDK is upgraded.

The SDK makes a better approach possible. Its shipped `.d.ts` files are unusually well specified:

```ts
/**
 * Style variant for the Button
 * @default "solid"
 */
variant?: Variants<"solid" | "soft" | "outline" | "ghost">
```

That is already a machine-readable spec for a form control — a label, a closed set of options, and
a default. [`scripts/generate-registry.mts`](./scripts/generate-registry.mts) walks those types with
the TypeScript compiler API and emits a JSON manifest. The inspector then renders controls purely
from `control` kinds:

| Control   | Derived from                             | Editor           |
| --------- | ---------------------------------------- | ---------------- |
| `enum`    | string-literal union                     | chips or select  |
| `boolean` | `boolean`                                | checkbox         |
| `string`  | `string`                                 | text input       |
| `number`  | `number`                                 | number input     |
| `icon`    | `ComponentType<SVGProps<SVGSVGElement>>` | icon search      |
| `node`    | `ReactNode`                              | child nodes      |
| `handler` | **required** `on*` callback              | exported stub    |
| `json`    | anything else                            | expression field |

**Consequence:** full coverage of the component surface is automatic, and upgrading the SDK is
`npm update && npm run generate:registry`. No component-specific code exists anywhere in the
inspector.

Current output for v0.2.2: **67 components** (including 27 compound parts), **745 icons**,
**510 props** — 90% of which resolve to a real control rather than a raw text box.

### What the generator can't know

Three things need human judgement, and only those live in
[`src/registry/overlay.ts`](./src/registry/overlay.ts):

1. **Categories** — which palette drawer a component belongs to.
2. **Composition rules** — `Menu.Item` is only valid inside `Menu.Content`. Radix throws if you
   violate this, so invalid drops are rejected rather than allowed to crash the canvas.
3. **Starter props** — a `Button` with no children renders as an empty pill. Seed values make a
   freshly dropped component look like the thing you had in mind.

---

## Design decisions worth knowing

**The canvas renders real components.** Not mocks, not an approximation. What you see is what the
exported code imports, so preview fidelity is exact by construction rather than by maintenance.

**Selection affordances don't distort layout.** Wrapping every node in a positioned `div` would
break flex/grid parents and Radix's trigger/content relationships. Instead, `data-*` attributes and
handlers are injected into each component's own props, and highlights use CSS `outline` — which
does not participate in layout. The handful of Radix parts that reject unknown props get a
`display: contents` wrapper, which carries affordances without creating a layout box.

**`Icon` is synthetic.** The SDK exports 745 individual icon components. Listing all of them in the
palette would be unusable, so the builder offers one `Icon` entry with a searchable picker; the
exporter emits the concrete tag (`<Maps />`) with the right named import.

**Layout primitives are host elements.** The SDK ships no layout components — its own README builds
cards from `div`s with Tailwind classes. `Card`, `Stack`, `Row`, `Grid` etc. follow that idiom and
export as plain elements, not fictional components.

---

## Verification

The thing that actually matters for a code generator is whether its output compiles. That is
checked, not assumed:

```bash
npm run verify
```

| Stage               | What it proves                                              |
| ------------------- | ----------------------------------------------------------- |
| `generate:registry` | The manifest matches the installed SDK                      |
| `model:smoke`       | Tree ops, composition rules, cycle rejection, undo/redo     |
| `export:smoke`      | Templates render to TSX in `src/__exporttest__/`            |
| `render:smoke`      | **Every** palette component + template mounts in a real DOM |
| `tsc -b`            | **The exported TSX type-checks against the real SDK**       |
| `vite build`        | Production build succeeds                                   |

That last pairing is the point. `export:smoke` writes generated code into `src/`, and `tsc` then
compiles it against the actual `@openai/apps-sdk-ui` types — so a bad export is a build failure.

It has already earned its keep. The round-trip caught four defects that looked fine on screen:

1. **Required event handlers were being dropped.** Seven props like `Slider.onChange` are
   mandatory; omitting them emitted code that would not compile — *and* crashed the canvas with
   "Expected a function". Now captured and stubbed in both places.
2. **`Button.icon` does not exist.** An early template invented it. The SDK composes icons as
   children.
3. **Layout primitives lost their `className`.** The exporter elides props equal to their default,
   which is right for SDK components and catastrophic for a `Card` whose class list *is* the
   component.
4. **Text/children precedence was inverted**, silently discarding nested icons.

None of these were visible in a screenshot. All were caught by compiling the output.

---

## Scripts

| Command                     | Purpose                                          |
| --------------------------- | ------------------------------------------------ |
| `npm run dev`               | Dev server                                       |
| `npm run build`             | Production build                                 |
| `npm run verify`            | Full pipeline (above)                            |
| `npm run generate:registry` | Rebuild the manifest from installed SDK types    |
| `npm run build:singlefile`  | Inline everything into one portable `index.html` |

## Upgrading the SDK

```bash
npm update @openai/apps-sdk-ui
npm run verify
```

`verify` regenerates the registry and fails loudly if anything moved. New components appear in the
palette with no code changes; new props appear in the inspector with the right control type. Only
genuinely new *composition rules* need a line in `overlay.ts`.

## Layout

```
scripts/
  generate-registry.mts   Type-driven manifest generator
  model-smoke.mts         Document-model behaviour tests
  export-smoke.mts        Emits TSX for tsc to verify
  render-smoke.mts        Mounts every component in a DOM
src/
  registry/               Generated manifest + overlay + facade
  state/                  Document model, exporter, persistence, templates
  builder/                Palette, Canvas, Inspector, LayerTree, CodePanel
```

## Requirements

Node 20+ (uses `--experimental-strip-types`), React 19, Tailwind 4.

## Notes

The stylesheet order in `src/main.css` is load-bearing — `@import "tailwindcss"` then
`@import "@openai/apps-sdk-ui/css"`, with `@source` pointing at the package so Tailwind keeps the
classes the SDK references. Change it and components render structurally correct but unstyled.

`AppsSDKUIProvider` requires a `linkComponent`; this app passes `"a"` since it has no router.

## License

MIT — as is [`@openai/apps-sdk-ui`](https://github.com/openai/apps-sdk-ui).
