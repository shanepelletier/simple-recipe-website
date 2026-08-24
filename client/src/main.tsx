import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import App from "./App.tsx";
import { AuthProvider } from "./core/auth.tsx";

// Self-hosted rather than loaded from a font CDN: no third-party request on
// first paint, and the files are versioned with the rest of the bundle.
// Fraunces ships as "full" because the display face uses its SOFT and WONK
// axes, not just weight; Source Sans only ever varies by weight.
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/source-sans-3";

import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
