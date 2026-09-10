// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { tratarComandoFiltro } from '../src/content/comando'

const BUSCA = 'https://www.facebook.com/ads/library/?q=emagrecer'
const AGORA = new Date('2026-09-06T12:00:00Z')

describe('tratarComandoFiltro', () => {
  it('navega para a URL com o corte aplicado', () => {
    const navegar = vi.fn()
    const ok = tratarComandoFiltro(
      { diasMin: 7, diasMax: null },
      BUSCA,
      AGORA,
      navegar,
    )

    expect(ok).toBe(true)
    expect(navegar).toHaveBeenCalledTimes(1)
    const url = new URL(navegar.mock.calls[0][0] as string)
    expect(url.searchParams.get('start_date[max]')).toBe('2026-08-30')
  })

  it('não navega quando o comando não presta', () => {
    const navegar = vi.fn()
    expect(tratarComandoFiltro({ diasMin: 7 }, BUSCA, AGORA, navegar)).toBe(false)
    expect(navegar).not.toHaveBeenCalled()
  })

  it('não navega quando a URL já é a que o comando pede', () => {
    // Recarregar a mesma página seria perder o índice da sessão por nada.
    const navegar = vi.fn()
    const alvo = urlDeReferencia()
    expect(
      tratarComandoFiltro({ diasMin: 7, diasMax: null }, alvo, AGORA, navegar),
    ).toBe(false)
    expect(navegar).not.toHaveBeenCalled()
  })

  /** A URL que o próprio comando produz, para comparar com ela mesma. */
  function urlDeReferencia(): string {
    const navegar = vi.fn()
    tratarComandoFiltro({ diasMin: 7, diasMax: null }, BUSCA, AGORA, navegar)
    return navegar.mock.calls[0][0] as string
  }
})
