/** Exercises the real edit loop: add -> set prop -> move -> undo -> export. */
import { createServer } from "vite"
const server = await createServer({ server:{middlewareMode:true}, appType:"custom", logLevel:"error" })
try {
  const d = await server.ssrLoadModule("/src/state/document.ts")
  const { exportToTsx } = await server.ssrLoadModule("/src/state/export.ts")
  const ok = (l:string,c:boolean)=>console.log(`${c?"PASS":"FAIL"}  ${l}`)

  let doc = d.emptyDocument()
  // 1. add a Card, then a Button inside it
  const a = d.addComponent(doc, "Card", { parentId:null, index:0 }); doc = a.doc
  ok("add Card at root", !!a.nodeId)
  const b = d.addComponent(doc, "Button", { parentId:a.nodeId, index:0 }); doc = b.doc
  ok("add Button into Card", !!b.nodeId)

  // 2. composition rules are enforced
  const bad = d.addComponent(doc, "Menu.Item", { parentId:a.nodeId, index:0 })
  ok("reject Menu.Item inside Card", bad.nodeId === undefined)
  const badRoot = d.addComponent(doc, "Menu.Item", { parentId:null, index:0 })
  ok("reject orphan Menu.Item at root", badRoot.nodeId === undefined)

  // 3. props + text
  doc = d.setProp(doc, b.nodeId, "color", { kind:"literal", value:"danger" })
  doc = d.setText(doc, b.nodeId, "Delete")
  ok("prop set", d.findNode(doc,b.nodeId).props.color.value === "danger")

  // 4. cannot drop a node into its own subtree
  const cyc = d.moveNode(doc, a.nodeId, { parentId:b.nodeId, index:0 })
  ok("reject move into own descendant", cyc === doc)

  // 5. duplicate assigns fresh ids
  const dup = d.duplicateNode(doc, b.nodeId)
  ok("duplicate creates new id", dup.nodeId && dup.nodeId !== b.nodeId)

  // 6. history
  let h = d.initHistory(d.emptyDocument())
  h = d.commit(h, doc)
  const undone = d.undo(h)
  ok("undo restores prior state", undone.present.root.length === 0)
  ok("redo returns to edited state", d.redo(undone).present.root.length === 1)

  // 7. export reflects edits
  const code = exportToTsx(doc, { componentName:"Demo" })
  ok("export includes edited prop", code.includes('color="danger"'))
  ok("export includes text", code.includes("Delete"))
  ok("export imports Button", code.includes('from "@openai/apps-sdk-ui/components/Button"'))
  console.log("\n" + code)
} finally { await server.close() }
