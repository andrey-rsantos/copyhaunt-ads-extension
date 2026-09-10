// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  atualizarProgresso,
  montarProgresso,
  rotuloDoEstado,
} from '../../src/content/progresso'
import type { Progresso } from '../../src/core/miner'

function progresso(p: Partial<Progresso> = {}): Progresso {
  return {
    estado: 'minerando',
    analisados: 0,
    encontrados: 0,
    rolagens: 0,
    ...p,
  }
}

describe('rotuloDoEstado', () => {
  it('traduz cada estado do motor para o vocabulário do usuário', () => {
    expect(rotuloDoEstado('minerando')).toBe('Minerando')
    expect(rotuloDoEstado('pausado')).toBe('Pausado')
    expect(rotuloDoEstado('concluido')).toBe('Concluído')
    expect(rotuloDoEstado('esgotado')).toBe('Fim dos resultados')
  })

  it('não fala de risco ao usuário, como a seção 6.2 exige', () => {
    // `limite-seguranca` e `incompreensivel` são vocabulário nosso.
    expect(rotuloDoEstado('limite-seguranca')).toBe('Mineração encerrada')
    expect(rotuloDoEstado('incompreensivel')).toBe('Mineração encerrada')
    expect(rotuloDoEstado('limite-seguranca')).not.toMatch(/risco|bloqueio/i)
  })
})

describe('cartão de progresso', () => {
  it('mostra os três contadores', () => {
    const c = montarProgresso(document, () => {})
    atualizarProgresso(
      c,
      progresso({ analisados: 152, encontrados: 18, rolagens: 22 }),
      100,
    )

    expect(c.querySelector('[data-papel="analisados"]')?.textContent).toBe('152')
    expect(c.querySelector('[data-papel="encontrados"]')?.textContent).toBe('18')
    expect(c.querySelector('[data-papel="rolagens"]')?.textContent).toBe('22')
  })

  it('a barra mede os encontrados contra o alvo, não os analisados', () => {
    const c = montarProgresso(document, () => {})
    atualizarProgresso(c, progresso({ analisados: 900, encontrados: 25 }), 100)

    const barra = c.querySelector<HTMLElement>('[data-papel="barra"]')
    expect(barra?.style.width).toBe('25%')
  })

  it('a barra não passa de 100% quando o lote cruza o alvo', () => {
    const c = montarProgresso(document, () => {})
    atualizarProgresso(c, progresso({ encontrados: 105 }), 100)

    const barra = c.querySelector<HTMLElement>('[data-papel="barra"]')
    expect(barra?.style.width).toBe('100%')
  })

  it('pausar chama o que foi passado', () => {
    const espiao = vi.fn()
    const c = montarProgresso(document, espiao)

    c.querySelector<HTMLElement>('[data-acao="pausar"]')?.click()

    expect(espiao).toHaveBeenCalledTimes(1)
  })

  it('some o botão pausar quando a mineração termina', () => {
    const c = montarProgresso(document, () => {})
    atualizarProgresso(c, progresso({ estado: 'esgotado' }), 100)

    const pausar = c.querySelector<HTMLElement>('[data-acao="pausar"]')
    expect(pausar?.hidden).toBe(true)
  })

  it('mantém o pausar durante uma pausa, para poder retomar', () => {
    const c = montarProgresso(document, () => {})
    atualizarProgresso(c, progresso({ estado: 'pausado' }), 100)

    const pausar = c.querySelector<HTMLElement>('[data-acao="pausar"]')
    expect(pausar?.hidden).toBe(false)
    expect(pausar?.textContent).toBe('Retomar')
  })
})
