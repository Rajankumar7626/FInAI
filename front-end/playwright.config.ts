import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const configDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(configDirectory, '..')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5175',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: '.\\.venv\\Scripts\\python.exe -m uvicorn tests.e2e_app:app --host 127.0.0.1 --port 8002',
      cwd: projectRoot,
      url: 'http://127.0.0.1:8002/health',
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        CORS_ORIGINS: 'http://127.0.0.1:5175',
      },
    },
    {
      command: 'npm run dev -- --mode e2e --host 127.0.0.1 --port 5175',
      cwd: configDirectory,
      url: 'http://127.0.0.1:5175',
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        VITE_API_BASE_URL: 'http://127.0.0.1:8002',
      },
    },
  ],
})
