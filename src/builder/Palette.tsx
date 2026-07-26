/**
 * Palette
 * -------
 * Searchable, category-grouped list of everything that can be placed on the
 * canvas. Contents come straight from the registry, so the palette gains new
 * components automatically when the SDK is upgraded.
 */

import { useMemo, useState } from "react"

import { cn } from "../lib/cn"
import { getPaletteGroups, SDK_VERSION, type RegistryEntry } from "../registry"
import { EmptyState, PanelHeader, SectionLabel, TextField } from "./ui"

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
      <PanelHeader className="flex-col items-stretch gap-2">
        <TextField
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search components…"
          aria-label="Search components"
        />
        <p className="text-xs tabular-nums text-tertiary">
          {total} components · Apps SDK UI v{SDK_VERSION}
        </p>
      </PanelHeader>

      <div className="builder-scroll flex-1 overflow-y-auto px-2 py-2">
        {groups.map((group) => (
          <section key={group.category} className="mb-4">
            <SectionLabel>{group.category}</SectionLabel>
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
          <EmptyState
            title="No matches"
            hint={`Nothing in the palette matches “${query}”. Try a shorter search.`}
          />
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
      className={cn(
        "group flex cursor-grab flex-col items-start gap-0.5 rounded-md border border-default",
        "bg-surface px-2 py-1.5 text-left transition-colors",
        "hover:border-blue-500 hover:bg-blue-50",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500",
        "active:cursor-grabbing",
      )}
    >
      <span className="w-full truncate text-xs font-medium text-gray-900">{entry.name}</span>
      {entry.blurb ? (
        <span className="w-full truncate text-xs text-tertiary">{entry.blurb}</span>
      ) : null}
    </button>
  )
}
