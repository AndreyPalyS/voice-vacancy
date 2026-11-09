import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './tests/browser', use: { baseURL: 'http://127.0.0.1:4173', headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' }, webServer: { command: 'npm run dev', url: 'http://127.0.0.1:4173', reuseExistingServer: true }, reporter: 'list' })
