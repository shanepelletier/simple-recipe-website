import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // The browser talks to :5173 for everything, so the API is same-origin and
  // session cookies plus CSRF work with no configuration. That is why there is
  // no CORS package on the server side.
  server: {
    proxy: {
      // /media matters as much as /api: uploaded photos are served from
      // /media/recipes/<uuid>.jpg, and without this line every image 404s
      // while the JSON works perfectly.
      "/api": { target: "http://localhost:8000" },
      "/media": { target: "http://localhost:8000" },
    },
  },
});
