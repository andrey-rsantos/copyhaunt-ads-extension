import { describe, expect, it, vi } from 'vitest'
import { criarCicloMineracao } from '../../src/content/ciclo-mineracao'

describe('ciclo de vida da mineração', () => {
  it('grava no máximo um checkpoint por transição para oculto', () => {
    const checkpoint = vi.fn(async () => true)
    const ciclo = criarCicloMineracao(() => ({ checkpoint }))

    ciclo.aoMudarVisibilidade('hidden')
    ciclo.aoMudarVisibilidade('hidden')

    expect(checkpoint).toHaveBeenCalledTimes(1)
  })

  it('não interrompe o motor ao ocultar a página', () => {
    const checkpoint = vi.fn(async () => true)
    const interromper = vi.fn()
    const ciclo = criarCicloMineracao(() => ({ checkpoint, interromper }))

    ciclo.aoMudarVisibilidade('hidden')

    expect(interromper).not.toHaveBeenCalled()
    expect(checkpoint).toHaveBeenCalledTimes(1)
  })

  it('usa pagehide como fallback sem lançar erro síncrono', () => {
    const checkpoint = vi.fn(() => {
      throw new Error('best effort')
    })
    const ciclo = criarCicloMineracao(() => ({ checkpoint }))

    expect(() => ciclo.aoPagehide()).not.toThrow()
    expect(checkpoint).toHaveBeenCalledTimes(1)
  })

  it('permite novo checkpoint depois de voltar ao visível', () => {
    const checkpoint = vi.fn(async () => true)
    const ciclo = criarCicloMineracao(() => ({ checkpoint }))

    ciclo.aoMudarVisibilidade('hidden')
    ciclo.aoMudarVisibilidade('visible')
    ciclo.aoMudarVisibilidade('hidden')

    expect(checkpoint).toHaveBeenCalledTimes(2)
  })
})
