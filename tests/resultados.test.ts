import { describe, expect, it } from 'vitest'
import {
  hidratarResultado,
  ordenarAnuncios,
  rotuloDoResultado,
  serializarResultado,
  type ResultadoLocal,
} from '../src/core/resultados'
import type { Ad } from '../src/core/types'

const AGORA = new Date('2026-09-17T12:00:00Z')
const INICIO = new Date('2026-09-10T12:00:00Z')
const DIAS_7_ATRAS = new Date('2026-09-10T12:00:00Z')
const DIAS_30_ATRAS = new Date('2026-08-18T12:00:00Z')
const DIAS_90_ATRAS = new Date('2026-06-19T12:00:00Z')

function anuncio(opcoes: Partial<Ad> = {}): Ad {
  return {
    id: 'base',
    iniciouEm: INICIO,
    colacao: 1,
    anunciante: { pageId: 'base-page', pageName: 'Anunciante base' },
    midias: [],
    plataformas: [],
    ativo: true,
    ...opcoes,
  }
}

function resultadoDeTeste(opcoes: Partial<ResultadoLocal> = {}): ResultadoLocal {
  return {
    origem: 'https://www.facebook.com/ads/library/?q=receitas',
    estado: 'esgotado',
    salvoEm: AGORA,
    anuncios: [anuncio()],
    ...opcoes,
  }
}

describe('resultado', () => {
  it('serializa e hidrata um snapshot interrompido', () => {
    const resultado = resultadoDeTeste({ estado: 'interrompida' })
    const hidratado = hidratarResultado(serializarResultado(resultado))

    expect(hidratado?.estado).toBe('interrompida')
    expect(hidratado?.anuncios).toHaveLength(resultado.anuncios.length)
  })

  it('traduz estados do snapshot para o cabeçalho', () => {
    expect(rotuloDoResultado('pausado')).toBe('Resultados parciais — mineração pausada')
    expect(rotuloDoResultado('interrompida')).toBe(
      'Resultados parciais — mineração interrompida',
    )
    expect(rotuloDoResultado('concluido')).toBe('Mineração concluída')
    expect(rotuloDoResultado('esgotado')).toBe('Fim dos resultados')
  })

  it('serializa e hidrata iniciouEm sem perder os campos opcionais', () => {
    const persistido = serializarResultado({
      origem: 'https://www.facebook.com/ads/library/?q=receitas',
      estado: 'esgotado',
      salvoEm: AGORA,
      anuncios: [anuncio({ iniciouEm: INICIO, titulo: undefined })],
    })

    const hidratado = hidratarResultado(persistido)

    expect(hidratado?.anuncios[0].iniciouEm).toEqual(INICIO)
    expect(hidratado?.anuncios[0].titulo).toBeUndefined()
    expect(hidratado?.salvoEm).toEqual(AGORA)
  })

  it('rejeita versão, data e anúncio inválidos sem lançar', () => {
    expect(hidratarResultado({ versao: 2 })).toBeNull()
    expect(hidratarResultado({ versao: 1, salvoEm: 'x', anuncios: [] })).toBeNull()
    expect(
      hidratarResultado({
        versao: 1,
        salvoEm: AGORA.toISOString(),
        origem: 'x',
        estado: 'esgotado',
        anuncios: [{ id: '' }],
      }),
    ).toBeNull()
  })

  it('ordena por tempo ativo, colação e presença do anunciante', () => {
    const anuncios = [
      anuncio({
        id: 'novo',
        iniciouEm: DIAS_7_ATRAS,
        colacao: 2,
        colacaoId: 'grupo-a',
        anunciante: { pageId: 'p1', pageName: 'Página 1' },
      }),
      anuncio({
        id: 'antigo',
        iniciouEm: DIAS_90_ATRAS,
        colacao: 1,
        colacaoId: 'grupo-a',
        anunciante: { pageId: 'p1', pageName: 'Página 1' },
      }),
      anuncio({
        id: 'outro',
        iniciouEm: DIAS_30_ATRAS,
        colacao: 1,
        anunciante: { pageId: 'p2', pageName: 'Página 2' },
      }),
    ]

    expect(ordenarAnuncios(anuncios, 'tempo', AGORA).map((a) => a.id)).toEqual([
      'antigo',
      'outro',
      'novo',
    ])
    expect(ordenarAnuncios(anuncios, 'colacao', AGORA).map((a) => a.id)).toEqual([
      'novo',
      'antigo',
      'outro',
    ])
    expect(
      ordenarAnuncios(anuncios, 'anunciante', AGORA).map((a) => a.id),
    ).toEqual(['novo', 'antigo', 'outro'])
  })
})
