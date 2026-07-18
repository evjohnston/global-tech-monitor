import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// If deploying to https://<user>.github.io/<repo>/, set base to "/<repo>/".
// For a user/root or custom domain, leave as "/".
const base = process.env.GTM_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [react()],
});
