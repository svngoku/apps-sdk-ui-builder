// Must be imported first so Tailwind layers and Apps SDK UI style foundations
// are defined before any component styles are evaluated.
import "./main.css"

import { AppsSDKUIProvider } from "@openai/apps-sdk-ui/components/AppsSDKUIProvider"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* No router in the builder shell, so plain anchors are the correct
        default link component for TextLink / ButtonLink. */}
    <AppsSDKUIProvider linkComponent="a">
      <App />
    </AppsSDKUIProvider>
  </StrictMode>,
)
