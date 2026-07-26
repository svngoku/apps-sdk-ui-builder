/**
 * Palette
 * -------
 * Searchable, category-grouped list of everything that can be placed on the
 * canvas. Contents come straight from the registry, so the palette gains new
 * components automatically when the SDK is upgraded.
 */

import { useMemo, useState } from "react"

import { getPaletteGroups, SDK_VERSION, type RegistryEntry } from "../registry"

type PaletteProps = {
  onAdd: (componentName: string) => void
  onDragComponent: (componentName: string | null) => void
}

export function Palette({ onAdd, onDragComponent }: PaletteProps) {
  const [query, setQuery] = useState("")
  const groups = useMemo(() => getPaletteGroups(query), [query])

  const total = useMemo(
    () => groups.reduce((count, group) => count + group.entries.length, 0),
    [groups],
  )

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-200 px-3 py-3 dark:border-neutral-800">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search components…"
          className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-[13px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <p className="mt-1.5 text-[11px] text-neutral-500">
          {total} components · Apps SDK UI v{SDK_VERSION}
        </p>
      </div>

      <div className="builder-scroll flex-1 overflow-y-auto px-2 py-2">
        {groups.map((group) => (
          <section key={group.category} className="mb-3">
            <h3 className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              {group.category}
            </h3>
            <div className="grid grid-cols-2 gap-1">
              {group.entries.map((entry) => (
                <PaletteItem
                  key={entry.name}
                  entry={entry}
                  onAdd={onAdd}
                  onDragComponent={onDragComponent}
                />
              ))}
            </div>
          </section>
        ))}

        {groups.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] text-neutral-500">
            No components match “{query}”.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function PaletteItem({
  entry,
  onAdd,
  onDragComponent,
}: {
  entry: RegistryEntry
  onAdd: (name: string) => void
  onDragComponent: (name: string | null) => void
}) {
  return (
    <button
      type="button"
      draggable
      onClick={() => onAdd(entry.name)}
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-component", entry.name)
        event.dataTransfer.effectAllowed = "copy"
        onDragComponent(entry.name)
      }}
      onDragEnd={() => onDragComponent(null)}
      title={entry.blurb ?? entry.name}
      className="group flex cursor-grab flex-col items-start rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-left transition-colors hover:border-blue-400 hover:bg-blue-50 active:cursor-grabbing dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-blue-600 dark:hover:bg-blue-950/40"
    >
      <span className="w-full truncate text-[12px] font-medium text-neutral-800 dark:text-neutral-200">
        {entry.name}
      </span>
      {entry.blurb ? (
        <span className="w-full truncate text-[10px] text-neutral-500">{entry.blurb}</span>
      ) : null}
    </button>
  )
}
