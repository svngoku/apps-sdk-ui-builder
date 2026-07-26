/**
 * Document model
 * --------------
 * Pure, serialisable operations over the UI tree. No React, no DOM — which is
 * what lets the exporter and the local-storage layer share the same structures,
 * and makes every operation trivially undoable by snapshotting.
 */

import { canContain, createNode, getEntry, nextId } from "../registry"
import type { PropValue, UINode } from "../registry/types"

export type UIDocument = {
  /** Top-level nodes composing the app surface. */
  root: UINode[]
}

export const emptyDocument = (): UIDocument => ({ root: [] })

/* -------------------------------------------------------------------------- */
/* Traversal                                                                   */
/* -------------------------------------------------------------------------- */

export function findNode(doc: UIDocument, id: string): UINode | undefined {
  let found: UINode | undefined
  walk(doc.root, (node) => {
    if (node.id === id) found = node
  })
  return found
}

export function walk(nodes: UINode[], visit: (node: UINode, parent?: UINode) => void, parent?: UINode) {
  for (const node of nodes) {
    visit(node, parent)
    walk(node.children, visit, node)
  }
}

export function findParent(doc: UIDocument, id: string): UINode | undefined {
  let parent: UINode | undefined
  walk(doc.root, (node, candidateParent) => {
    if (node.id === id) parent = candidateParent
  })
  return parent
}

/** Ancestor chain from the node's parent up to the root, nearest first. */
export function ancestorsOf(doc: UIDocument, id: string): UINode[] {
  const chain: UINode[] = []
  let current = findParent(doc, id)
  while (current) {
    chain.push(current)
    current = findParent(doc, current.id)
  }
  return chain
}

/** Guard against dropping a node into its own subtree. */
export function isDescendant(ancestor: UINode, candidateId: string): boolean {
  let result = false
  walk(ancestor.children, (node) => {
    if (node.id === candidateId) result = true
  })
  return result
}

/* -------------------------------------------------------------------------- */
/* Structural edits                                                            */
/* -------------------------------------------------------------------------- */

const clone = <T,>(value: T): T => structuredClone(value)

/** Detach a node, returning the modified doc and the removed node. */
function detach(doc: UIDocument, id: string): { doc: UIDocument; node?: UINode } {
  const next = clone(doc)
  let removed: UINode | undefined

  const prune = (list: UINode[]): UINode[] => {
    const index = list.findIndex((node) => node.id === id)
    if (index !== -1) {
      removed = list[index]
      return [...list.slice(0, index), ...list.slice(index + 1)]
    }
    return list.map((node) => ({ ...node, children: prune(node.children) }))
  }

  next.root = prune(next.root)
  return { doc: next, node: removed }
}

export type DropPosition = { parentId: string | null; index: number }

/**
 * Insert `node` at a drop position. Returns the document unchanged when the
 * placement would violate a composition rule — the caller surfaces this as a
 * rejected drop rather than a crash.
 */
export function insertNode(doc: UIDocument, node: UINode, at: DropPosition): UIDocument {
  if (at.parentId === null) {
    const next = clone(doc)
    const index = Math.max(0, Math.min(at.index, next.root.length))
    next.root.splice(index, 0, node)
    return next
  }

  const parent = findNode(doc, at.parentId)
  if (!parent) return doc
  if (!canContain(parent.component, node.component)) return doc

  const next = clone(doc)
  const target = findNode(next, at.parentId)
  if (!target) return doc

  // A node cannot hold both text and element children.
  if (target.text !== undefined) delete target.text

  const index = Math.max(0, Math.min(at.index, target.children.length))
  target.children.splice(index, 0, node)
  return next
}

export function addComponent(
  doc: UIDocument,
  componentName: string,
  at: DropPosition,
): { doc: UIDocument; nodeId?: string } {
  const entry = getEntry(componentName)
  if (!entry) return { doc }

  // Top-level drops of constrained parts are rejected outright.
  if (at.parentId === null && entry.overlay?.requiresAncestor?.length) return { doc }

  const node = createNode(componentName)
  const next = insertNode(doc, node, at)
  return next === doc ? { doc } : { doc: next, nodeId: node.id }
}

export function removeNode(doc: UIDocument, id: string): UIDocument {
  return detach(doc, id).doc
}

export function moveNode(doc: UIDocument, id: string, to: DropPosition): UIDocument {
  const source = findNode(doc, id)
  if (!source) return doc

  // Moving a node inside itself would orphan the subtree.
  if (to.parentId === id) return doc
  if (to.parentId && isDescendant(source, to.parentId)) return doc

  if (to.parentId) {
    const parent = findNode(doc, to.parentId)
    if (!parent || !canContain(parent.component, source.component)) return doc
  } else if (getEntry(source.component)?.overlay?.requiresAncestor?.length) {
    return doc
  }

  // Removing first shifts indices within the same parent; compensate so a
  // drag from index 0 to index 2 lands where the user aimed.
  const currentParent = findParent(doc, id)
  const currentParentId = currentParent?.id ?? null
  const siblings = currentParent ? currentParent.children : doc.root
  const currentIndex = siblings.findIndex((node) => node.id === id)

  let targetIndex = to.index
  if (currentParentId === to.parentId && currentIndex !== -1 && currentIndex < to.index) {
    targetIndex -= 1
  }

  const { doc: without, node } = detach(doc, id)
  if (!node) return doc
  return insertNode(without, node, { parentId: to.parentId, index: targetIndex })
}

/** Deep-copy a node and its subtree with fresh ids. */
function reid(node: UINode): UINode {
  return { ...clone(node), id: nextId(), children: node.children.map(reid) }
}

export function duplicateNode(doc: UIDocument, id: string): { doc: UIDocument; nodeId?: string } {
  const node = findNode(doc, id)
  if (!node) return { doc }

  const copy = reid(node)
  const parent = findParent(doc, id)
  const siblings = parent ? parent.children : doc.root
  const index = siblings.findIndex((sibling) => sibling.id === id)

  const next = insertNode(doc, copy, {
    parentId: parent?.id ?? null,
    index: index === -1 ? siblings.length : index + 1,
  })
  return next === doc ? { doc } : { doc: next, nodeId: copy.id }
}

/** Reorder within the current parent. Used by keyboard nudges. */
export function shiftNode(doc: UIDocument, id: string, delta: number): UIDocument {
  const parent = findParent(doc, id)
  const siblings = parent ? parent.children : doc.root
  const index = siblings.findIndex((node) => node.id === id)
  if (index === -1) return doc

  const target = index + delta
  if (target < 0 || target >= siblings.length) return doc

  const next = clone(doc)
  const list = parent ? findNode(next, parent.id)!.children : next.root
  const [moved] = list.splice(index, 1)
  list.splice(target, 0, moved)
  return next
}

/* -------------------------------------------------------------------------- */
/* Content edits                                                               */
/* -------------------------------------------------------------------------- */

export function setProp(doc: UIDocument, id: string, name: string, value: PropValue | undefined): UIDocument {
  const next = clone(doc)
  const node = findNode(next, id)
  if (!node) return doc

  if (value === undefined) delete node.props[name]
  else node.props[name] = value

  return next
}

export function setText(doc: UIDocument, id: string, text: string): UIDocument {
  const next = clone(doc)
  const node = findNode(next, id)
  if (!node) return doc

  node.text = text
  // Text and element children are mutually exclusive.
  if (text) node.children = []
  return next
}

/* -------------------------------------------------------------------------- */
/* History                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Snapshot-based undo. Documents here are small (tens of nodes), so cloning
 * whole trees is far simpler than maintaining inverse operations and has no
 * perceptible cost at this scale.
 */
export type History = {
  past: UIDocument[]
  present: UIDocument
  future: UIDocument[]
}

const HISTORY_LIMIT = 100

export const initHistory = (present: UIDocument): History => ({ past: [], present, future: [] })

export function commit(history: History, next: UIDocument): History {
  if (next === history.present) return history
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  }
}

export function undo(history: History): History {
  if (history.past.length === 0) return history
  const previous = history.past[history.past.length - 1]
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future].slice(0, HISTORY_LIMIT),
  }
}

export function redo(history: History): History {
  if (history.future.length === 0) return history
  const [next, ...rest] = history.future
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: rest,
  }
}
