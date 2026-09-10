/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: vi.fn(),
      getURL: vi.fn((caminho: string) => `chrome-extension://teste/${caminho}`),
    },
  })
})

describe('content script', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.innerHTML = ''
  })

  it('planta os três enxertos na barra da Meta', async () => {
    document.body.innerHTML = `
      <div id="barra" style="display:flex;flex-direction:row">
        <div><div role="combobox">Brazil</div></div>
        <div><input type="search"></div>
      </div>
    `

    await import('../../src/content/index')

    await vi.waitFor(() => {
      const host = document.getElementById('copyhaunt-enxertos')
      expect(host).not.toBeNull()

      const shadow = host?.shadowRoot
      expect(shadow?.querySelector('[data-chave="ajuda"]')).not.toBeNull()
      expect(shadow?.querySelector('[data-chave="calendario"]')).not.toBeNull()
      expect(shadow?.querySelector('[data-chave="minerar"]')).not.toBeNull()
      // Teto explícito, não espera fixa: o `waitFor` sai assim que a condição
      // vale. O plantio passa pelo observador do body, com agrupamento de
      // 150 ms, e o teto padrão de 1 s estourou uma vez com a suíte inteira
      // disputando CPU — 47 workers, um por arquivo.
    }, { timeout: 5000, interval: 25 })
  })

  it('não monta mais o painel flutuante em iframe', async () => {
    document.body.innerHTML = `
      <div id="barra" style="display:flex;flex-direction:row">
        <div><div role="combobox">Brazil</div></div>
        <div><input type="search"></div>
      </div>
    `

    await import('../../src/content/index')

    expect(document.getElementById('copyhaunt-panel')).toBeNull()
  })
})
