/**
 * Layer tree
 * ----------
 * Structural view of the document. Essential for reaching nodes that are hard
 * to click on the canvas — a `Menu.Content` only exists while the menu is open,
 * and `display: contents` wrappers have no clickable box of their own.
 */

import type { UINode } from "../registry/types"

type LayerTreeProps = {
  nodes: UINode[]
  selectedId: string | null
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

export function LayerTree({ nodes, selectedId, onSelect, onHover }: LayerTreeProps) {
  if (nodes.length === 0) {
    return <p className="px-3 py-2 text-[11px] text-neutral-500">Canvas is empty.</p>
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
  const label = node.text ? `${node.component} · ${truncate(node.text)}` : node.component

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        style={{ paddingLeft: 8 + depth * 12 }}
        className={
          "flex w-full items-center gap-1 py-1 pr-2 text-left text-[11px] transition-colors " +
          (isSelected
            ? "bg-blue-500 text-white"
            : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800")
        }
      >
        <span className="truncate">{label}</span>
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

const truncate = (text: string, max = 18) =>
  text.length > max ? `${text.slice(0, max)}…` : text
