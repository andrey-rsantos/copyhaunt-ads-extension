import { describe, expect, it } from 'vitest'
import { montarDestinos } from '../src/core/links'
import type { Ad } from '../src/core/types'

function ad(extra: Partial<Ad> = {}): Ad {
  return {
    id: '652131454176487',
    iniciouEm: new Date('2026-08-01T00:00:00Z'),
    colacao: 1,
    anunciante: { pageId: '378128628724966', pageName: 'Renan Botelho Dr' },
    destino: 'https://exemplo.com/oferta?utm_source=fb',
    midias: [],
    plataformas: [],
    ativo: true,
    ...extra,
  }
}

function url(ad: Ad, chave: string): string | null {
  return montarDestinos(ad).find((d) => d.chave === chave)?.url ?? null
}

describe('montarDestinos', () => {
  it('devolve os seis destinos, sempre na mesma ordem', () => {
    const chaves = montarDestinos(ad()).map((d) => d.chave)
    expect(chaves).toEqual([
      'site',
      'perfil',
      'instagram',
      'anunciosDoSite',
      'anunciosDoAnunciante',
      'permalink',
    ])
  })

  it('site é a URL de destino real, com parâmetros', () => {
    expect(url(ad(), 'site')).toBe('https://exemplo.com/oferta?utm_source=fb')
  })

  it('perfil usa o pageId', () => {
    expect(url(ad(), 'perfil')).toContain('378128628724966')
  })

  it('permalink aponta para o anúncio na Biblioteca', () => {
    const u = url(ad(), 'permalink') ?? ''
    expect(u).toContain('/ads/library/')
    expect(u).toContain('652131454176487')
  })

  it('anúncios do anunciante usa view_all_page_id', () => {
    expect(url(ad(), 'anunciosDoAnunciante')).toContain(
      'view_all_page_id=378128628724966',
    )
  })

  it('anúncios do site busca pelo domínio, sem o caminho', () => {
    const u = url(ad(), 'anunciosDoSite') ?? ''
    expect(u).toContain('exemplo.com')
    expect(u).not.toContain('utm_source')
  })

  it('sem destino, os itens de site ficam nulos', () => {
    const a = ad({ destino: undefined })
    expect(url(a, 'site')).toBeNull()
    expect(url(a, 'anunciosDoSite')).toBeNull()
  })

  it('deriva o Instagram quando o destino é um perfil', () => {
    // Medido: 11% dos anúncios apontam para o Instagram, e nesses o destino
    // é o próprio perfil do anunciante.
    const a = ad({ destino: 'https://www.instagram.com/_u/ricardoperuffo' })
    expect(url(a, 'instagram')).toBe('https://www.instagram.com/ricardoperuffo')
  })

  it('normaliza a forma sem www e com barra final', () => {
    const a = ad({ destino: 'http://instagram.com/rap10oficial/' })
    expect(url(a, 'instagram')).toBe('https://www.instagram.com/rap10oficial')
  })

  it('Instagram fica nulo quando não dá para derivar', () => {
    expect(url(ad(), 'instagram')).toBeNull()
  })

  it('usa o Instagram do anunciante quando ele existe', () => {
    const a = ad({
      anunciante: {
        pageId: '1',
        pageName: 'X',
        instagram: 'https://www.instagram.com/oficial',
      },
    })
    expect(url(a, 'instagram')).toBe('https://www.instagram.com/oficial')
  })

  it('todo destino tem rótulo em pt-BR', () => {
    for (const d of montarDestinos(ad())) {
      expect(d.rotulo.length).toBeGreaterThan(0)
    }
  })
})
