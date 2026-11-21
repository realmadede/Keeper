import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (!cap?.isNativePlatform?.()) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Service worker registration is best-effort
      });
    });
  }
}
