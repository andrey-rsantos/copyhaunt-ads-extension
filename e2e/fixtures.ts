import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test as base, chromium, type BrowserContext } from '@playwright/test'

const CAMINHO_EXTENSAO = resolve(import.meta.dirname, '..', 'dist')

export const test = base.extend<{
  context: BrowserContext
  extensionId: string
}>({
  context: async ({}, use) => {
    // Extensões no Chromium só funcionam em contexto persistente, e cada
    // execução ganha um perfil descartável para não herdar estado.
    const perfil = mkdtempSync(join(tmpdir(), 'copyhaunt-'))
    const context = await chromium.launchPersistentContext(perfil, {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${CAMINHO_EXTENSAO}`,
        `--load-extension=${CAMINHO_EXTENSAO}`,
      ],
    })
    await use(context)
    await context.close()
    rmSync(perfil, { recursive: true, force: true })
  },

  extensionId: async ({ context }, use) => {
    // O service worker MV3 pode ainda não ter acordado quando o contexto sobe.
    let [worker] = context.serviceWorkers()
    if (!worker) worker = await context.waitForEvent('serviceworker')
    const id = new URL(worker.url()).host
    await use(id)
  },
})

export const expect = test.expect
