/**
 * Layer tree
 * ----------
 * Structural view of the document. Essential for reaching nodes that are hard
 * to click on the canvas — a `Menu.Content` only exists while the menu is open,
 * and `display: contents` wrappers have no clickable box of their own.
 */

import { cn } from "../lib/cn"
import type { UINode } from "../registry/types"

type LayerTreeProps = {
  nodes: UINode[]
  selectedId: string | null
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

export function LayerTree({ nodes, selectedId, onSelect, onHover }: LayerTreeProps) {
  if (nodes.length === 0) {
    return <p className="px-3 py-2 text-xs text-tertiary">Canvas is empty.</p>
  }

  return (
    <ul className="py-1">
      {nodes.map((node) => (
        <LayerRow
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </ul>
  )
}

function LayerRow({
  node,
  depth,
  selectedId,
  onSelect,
  onHover,
}: {
  node: UINode
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}) {
  const isSelected = node.id === selectedId

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        aria-current={isSelected ? "true" : undefined}
        // Indentation is data-driven, so it stays inline rather than becoming
        // an unbounded set of padding utilities.
        style={{ paddingInlineStart: 8 + depth * 12 }}
        className={cn(
          "flex w-full items-baseline gap-1.5 py-1 pe-2 text-left text-xs transition-colors",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500",
          isSelected
            ? "bg-blue-600 text-white"
            : "text-secondary hover:bg-gray-100 hover:text-gray-900",
        )}
      >
        <span className="truncate font-medium">{node.component}</span>
        {node.text ? (
          <span className={cn("truncate", isSelected ? "text-blue-100" : "text-tertiary")}>
            {node.text}
          </span>
        ) : null}
      </button>

      {node.children.length > 0 ? (
        <ul>
          {node.children.map((child) => (
            <LayerRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onHover={onHover}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
