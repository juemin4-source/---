import { defineConfig } from "vite";
export default defineConfig({
  server: {
    watch: {
      ignored: ["**/.playwright-cli/**", "**/output/**", "**/dist/**", "**/scripts/**", "**/tests/**"],
    },
  },
  build: {
    rollupOptions: { output: { manualChunks: { phaser: ["phaser"] } } },
  },
});
