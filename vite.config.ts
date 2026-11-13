import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    modules: {
      // CSS class "state-link" is used in code as styles.stateLink
      localsConvention: 'camelCaseOnly',
    },
  },
})
