import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cpSync, existsSync } from 'node:fs'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'copy-mockups',
      closeBundle() {
        const src = import.meta.dirname + '/../myprosole_app/design'
        const dest = import.meta.dirname + '/dist/design'
        if (existsSync(src)) {
          cpSync(src, dest, { recursive: true })
        }
      },
    },
  ],
})
