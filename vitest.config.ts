import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    bail: 1,
    globalSetup: './vitest.globalSetup.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/api-primary-node/src'),
    },
  },
})