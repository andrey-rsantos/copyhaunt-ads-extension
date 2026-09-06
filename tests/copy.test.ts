import { describe, expect, it } from 'vitest'
import { montarCopias } from '../src/core/copy'
import type { Ad } from '../src/core/types'

function ad(extra: Partial<Ad> = {}): Ad {
  return {
    id: '652131454176487',
    iniciouEm: new Date('2026-08-01T00:00:00Z'),
    colacao: 1,
    anunciante: { pageId: '378128628724966', pageName: 'Renan Botelho Dr' },
    texto: 'O que é EBITDA em um post',
    titulo: 'Aprenda a calcular',
    descricao: 'Passo a passo em cinco minutos',
    destino: 'https://exemplo.com/oferta?utm_source=fb',
    midias: [],
    plataformas: [],
    ativo: true,
    ...extra,
  }
}

function valor(a: Ad, chave: string): string | null {
  return montarCopias(a).find((i) => i.chave === chave)?.valor ?? null
}

describe('montarCopias', () => {
  it('devolve os cinco itens, sempre na mesma ordem', () => {
    expect(montarCopias(ad()).map((i) => i.chave)).toEqual([
      'texto',
      'titulo',
      'descricao',
      'site',
      'tudo',
    ])
  })

  it('leva cada campo do anúncio ao seu item', () => {
    const a = ad()
    expect(valor(a, 'texto')).toBe('O que é EBITDA em um post')
    expect(valor(a, 'titulo')).toBe('Aprenda a calcular')
    expect(valor(a, 'descricao')).toBe('Passo a passo em cinco minutos')
    expect(valor(a, 'site')).toBe('https://exemplo.com/oferta?utm_source=fb')
  })

  it('"tudo" junta as partes existentes, separadas por linha em branco', () => {
    expect(valor(ad(), 'tudo')).toBe(
      'O que é EBITDA em um post\n\n' +
        'Aprenda a calcular\n\n' +
        'Passo a passo em cinco minutos\n\n' +
        'https://exemplo.com/oferta?utm_source=fb',
    )
  })

  it('"tudo" pula o que falta em vez de deixar buraco', () => {
    const a = ad({ titulo: undefined, descricao: undefined })
    expect(valor(a, 'tudo')).toBe(
      'O que é EBITDA em um post\n\nhttps://exemplo.com/oferta?utm_source=fb',
    )
  })

  it('item sem dado vem com valor null, e continua na lista', () => {
    const a = ad({ descricao: undefined })
    expect(valor(a, 'descricao')).toBeNull()
    expect(montarCopias(a)).toHaveLength(5)
  })

  it('anúncio sem nada aproveitável deixa "tudo" nulo', () => {
    const a = ad({
      texto: undefined,
      titulo: undefined,
      descricao: undefined,
      destino: undefined,
    })
    expect(valor(a, 'tudo')).toBeNull()
  })
})
