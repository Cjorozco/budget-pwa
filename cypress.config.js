import path from 'node:path'
import { defineConfig } from 'cypress'

const DEMO_VIEWPORT = {
  width: Number(process.env.CYPRESS_VIEWPORT_WIDTH ?? 390),
  height: Number(process.env.CYPRESS_VIEWPORT_HEIGHT ?? 844),
}

/** Fuera del repo (OneDrive rompe ffmpeg). Override: CYPRESS_VIDEOS_FOLDER */
const VIDEOS_FOLDER =
  process.env.CYPRESS_VIDEOS_FOLDER ??
  path.join('C:', 'Users', 'JoseO', 'Videos', 'personal-buget-pwa')

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.{js,ts}',
    supportFile: 'cypress/support/e2e.js',
    viewportWidth: DEMO_VIEWPORT.width,
    viewportHeight: DEMO_VIEWPORT.height,
    video: true,
    videosFolder: VIDEOS_FOLDER,
    screenshotsFolder: 'cypress/screenshots',
    trashAssetsBeforeRuns: true,
    defaultCommandTimeout: 15_000,
    requestTimeout: 15_000,
    pageLoadTimeout: 30_000,
    setupNodeEvents(_on, config) {
      if (config.env.demoMode) {
        config.viewportWidth = DEMO_VIEWPORT.width
        config.viewportHeight = DEMO_VIEWPORT.height
        config.video = true
      }
      return config
    },
  },
})
