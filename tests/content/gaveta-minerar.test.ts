// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { montarMinerar } from '../../src/content/gaveta-minerar'

const agora = new Date('2026-09-10T12:00:00Z')
const URL_ATUAL =
  'https://www.facebook.com/ads/library/?q=emagrecimento&country=BR&active_status=active'

describe('montarMinerar', () => {
  it('mostra a linha "Vai varrer" com a busca em vigor', () => {
    const el = montarMinerar(document, URL_ATUAL, agora, () => {})
    const resumo = el.querySelector('[data-papel="vai-varrer"]')

    expect(resumo?.textContent).toContain('emagrecimento')
    expect(resumo?.textContent).toContain('Brasil')
  })

  it('começa nos padrões: colação 5, presença 10, alvo 100', () => {
    const el = montarMinerar(document, URL_ATUAL, agora, () => {})
    const v = (c: string) =>
      el.querySelector<HTMLInputElement>(`[data-campo="${c}"]`)?.value

    expect(v('colacaoMinima')).toBe('5')
    expect(v('presencaMinima')).toBe('10')
    expect(v('limiteEncontrados')).toBe('100')
  })

  it('iniciar entrega os critérios e o alvo', () => {
    const espiao = vi.fn()
    const el = montarMinerar(document, URL_ATUAL, agora, espiao)

    el.querySelector<HTMLElement>('[data-acao="iniciar"]')?.click()

    expect(espiao).toHaveBeenCalledWith({
      criterios: {
        colacaoMinima: 5,
        diasMin: null,
        diasMax: null,
        presencaMinima: 10,
      },
      limiteEncontrados: 100,
      exigirInstagram: false,
    })
  })

  it('avisa que o Instagram roda ao final e pode reduzir o total', () => {
    const el = montarMinerar(document, URL_ATUAL, agora, () => {})
    const nota = el.querySelector('[data-papel="nota-instagram"]')

    expect(nota?.textContent).toContain('ao final')
    expect(nota?.textContent).toContain('aprovados')
    expect(nota?.textContent).not.toContain('durante a varredura.')
  })

  it('o toggle do Instagram viaja no pedido quando ligado', () => {
    const espiao = vi.fn()
    const el = montarMinerar(document, URL_ATUAL, agora, espiao)

    const ig = el.querySelector<HTMLInputElement>(
      '[data-campo="exigirInstagram"]',
    )
    if (ig) ig.checked = true

    el.querySelector<HTMLElement>('[data-acao="iniciar"]')?.click()

    expect(espiao.mock.calls[0][0].exigirInstagram).toBe(true)
  })

  it('herda o tempo ativo da URL como critério do motor', () => {
    const espiao = vi.fn()
    const el = montarMinerar(
      document,
      `${URL_ATUAL}&start_date[max]=2026-09-03`,
      agora,
      espiao,
    )

    el.querySelector<HTMLElement>('[data-acao="iniciar"]')?.click()

    expect(espiao.mock.calls[0][0].criterios.diasMin).toBe(7)
  })

  it('alvo fora de 1 a 100 não inicia e avisa', () => {
    const espiao = vi.fn()
    const el = montarMinerar(document, URL_ATUAL, agora, espiao)

    const alvo = el.querySelector<HTMLInputElement>(
      '[data-campo="limiteEncontrados"]',
    )
    if (alvo) alvo.value = '500'

    el.querySelector<HTMLElement>('[data-acao="iniciar"]')?.click()

    expect(espiao).not.toHaveBeenCalled()
    expect(el.textContent).toContain('entre 1 e 100')
  })

  it('critério zerado vira null, que é critério desligado', () => {
    const espiao = vi.fn()
    const el = montarMinerar(document, URL_ATUAL, agora, espiao)

    const colacao = el.querySelector<HTMLInputElement>(
      '[data-campo="colacaoMinima"]',
    )
    if (colacao) colacao.value = ''

    el.querySelector<HTMLElement>('[data-acao="iniciar"]')?.click()

    expect(espiao.mock.calls[0][0].criterios.colacaoMinima).toBeNull()
  })
})
