
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { projectId, publicAnonKey } from "/utils/supabase/info";

  // Warm-up both edge functions at app startup — fires before any page renders,
  // so make-server is no longer cold when the user reaches the login/OTP screen.
  (function warmUpEdgeFunctions() {
    const h = { Authorization: `Bearer ${publicAnonKey}` };
    fetch(`https://${projectId}.supabase.co/functions/v1/make-server-218684af/ping`, { headers: h }).catch(() => {});
    fetch(`https://${projectId}.supabase.co/functions/v1/ai-fowards/ping`, { headers: h }).catch(() => {});
  })();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  createRoot(document.getElementById("root")!).render(<App />);
  