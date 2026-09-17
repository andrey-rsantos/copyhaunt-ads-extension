// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  atualizarProgresso,
  liberarResultados,
  montarProgresso,
  rotuloDoEstado,
  type AcoesProgresso,
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

function acoes(parcial: Partial<AcoesProgresso> = {}): AcoesProgresso {
  return {
    aoAlternarPausa: vi.fn(),
    aoAbrirResultados: vi.fn(),
    aoParar: vi.fn(),
    aoMinerarNovamente: vi.fn(),
    ...parcial,
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
  it('começa sem resultado e libera o atalho quando solicitado', () => {
    const c = montarProgresso(document, acoes())
    const botao = c.querySelector<HTMLButtonElement>('[data-acao="resultados"]')!

    expect(botao.hidden).toBe(true)
    expect(botao.disabled).toBe(true)

    liberarResultados(c)

    expect(botao.hidden).toBe(false)
    expect(botao.disabled).toBe(false)
  })

  it('mostra os três contadores', () => {
    const c = montarProgresso(document, acoes())
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
    const c = montarProgresso(document, acoes())
    atualizarProgresso(c, progresso({ analisados: 900, encontrados: 25 }), 100)

    const barra = c.querySelector<HTMLElement>('[data-papel="barra"]')
    expect(barra?.style.width).toBe('25%')
  })

  it('a barra não passa de 100% quando o lote cruza o alvo', () => {
    const c = montarProgresso(document, acoes())
    atualizarProgresso(c, progresso({ encontrados: 105 }), 100)

    const barra = c.querySelector<HTMLElement>('[data-papel="barra"]')
    expect(barra?.style.width).toBe('100%')
  })

  it('pausar chama o que foi passado', () => {
    const espiao = vi.fn()
    const c = montarProgresso(document, acoes({ aoAlternarPausa: espiao }))

    c.querySelector<HTMLElement>('[data-acao="pausar"]')?.click()

    expect(espiao).toHaveBeenCalledTimes(1)
  })

  it('some o botão pausar quando a mineração termina', () => {
    const c = montarProgresso(document, acoes())
    atualizarProgresso(c, progresso({ estado: 'esgotado' }), 100)

    const pausar = c.querySelector<HTMLElement>('[data-acao="pausar"]')
    expect(pausar?.hidden).toBe(true)
  })

  it('mantém o pausar durante uma pausa, para poder retomar', () => {
    const c = montarProgresso(document, acoes())
    atualizarProgresso(c, progresso({ estado: 'pausado' }), 100)

    const pausar = c.querySelector<HTMLElement>('[data-acao="pausar"]')
    expect(pausar?.hidden).toBe(false)
    expect(pausar?.textContent).toBe('Retomar')
  })

  it('mostra parar e resultados somente depois de uma pausa', () => {
    const cartao = montarProgresso(document, acoes())

    atualizarProgresso(cartao, progresso({ estado: 'pausado' }), 100)

    expect(cartao.querySelector<HTMLButtonElement>('[data-acao="parar"]')?.hidden).toBe(false)
    expect(cartao.querySelector<HTMLButtonElement>('[data-acao="resultados"]')?.hidden).toBe(false)
    expect(cartao.querySelector<HTMLButtonElement>('[data-acao="resultados"]')?.hasAttribute('disabled')).toBe(true)
    expect(cartao.querySelector<HTMLButtonElement>('[data-acao="repetir"]')?.hidden).toBe(true)
  })

  it('esconde parar e repetir enquanto minera', () => {
    const cartao = montarProgresso(document, acoes())

    atualizarProgresso(cartao, progresso({ estado: 'minerando' }), 100)

    expect(cartao.querySelector<HTMLButtonElement>('[data-acao="pausar"]')?.hidden).toBe(false)
    expect(cartao.querySelector<HTMLButtonElement>('[data-acao="parar"]')?.hidden).toBe(true)
    expect(cartao.querySelector<HTMLButtonElement>('[data-acao="repetir"]')?.hidden).toBe(true)
    expect(cartao.querySelector<HTMLButtonElement>('[data-acao="resultados"]')?.hidden).toBe(true)
  })

  it('mostra resultados e minerar novamente após interrupção', () => {
    const cartao = montarProgresso(document, acoes())

    atualizarProgresso(cartao, progresso({ estado: 'interrompida' }), 100)

    expect(cartao.querySelector<HTMLButtonElement>('[data-acao="resultados"]')?.hidden).toBe(false)
    expect(cartao.querySelector<HTMLButtonElement>('[data-acao="repetir"]')?.hidden).toBe(false)
    expect(cartao.querySelector<HTMLButtonElement>('[data-acao="parar"]')?.hidden).toBe(true)
    expect(cartao.querySelector<HTMLButtonElement>('[data-acao="pausar"]')?.hidden).toBe(true)
  })

  it('dispara parar e repetir pelos callbacks corretos', () => {
    const aoParar = vi.fn()
    const aoMinerarNovamente = vi.fn()
    const cartao = montarProgresso(document, acoes({ aoParar, aoMinerarNovamente }))

    cartao.querySelector<HTMLButtonElement>('[data-acao="parar"]')?.click()
    cartao.querySelector<HTMLButtonElement>('[data-acao="repetir"]')?.click()

    expect(aoParar).toHaveBeenCalledTimes(1)
    expect(aoMinerarNovamente).toHaveBeenCalledTimes(1)
  })
})
