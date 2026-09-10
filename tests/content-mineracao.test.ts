/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarMinerador } from '../src/content/index'
import { CRITERIOS_PADRAO } from '../src/core/criteria'
import { AdStore } from '../src/core/store'

vi.hoisted(() => {
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: vi.fn(),
      getURL: vi.fn((caminho: string) => `chrome-extension://teste/${caminho}`),
    },
  })
})

class WorkerDeTeste {
  onmessage: ((evento: MessageEvent<{ id: number }>) => void) | null = null
  postMessage(): void {}
}

describe('criarMinerador', () => {
  const RITMO = { pisoMs: 2500, timeoutMs: 4500, jitter: 0.4 }

  beforeEach(() => {
    vi.stubGlobal('Worker', WorkerDeTeste)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('monta um minerador parado, sem rolar nada', () => {
    const scrollBy = vi.fn()
    vi.stubGlobal('scrollBy', scrollBy)

    const m = criarMinerador(new AdStore(), CRITERIOS_PADRAO, 100, RITMO)

    expect(m.progresso()).toEqual({
      estado: 'parado',
      analisados: 0,
      encontrados: 0,
      rolagens: 0,
    })
    expect(scrollBy).not.toHaveBeenCalled()
  })

  it('repassa o teto de aprovados ao motor', () => {
    expect(() => criarMinerador(
      new AdStore(),
      CRITERIOS_PADRAO,
      101,
      RITMO,
    )).toThrow(RangeError)
  })

})
