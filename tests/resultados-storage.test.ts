import { describe, expect, it } from 'vitest'
import { CHAVE_RESULTADO, type ResultadoLocal } from '../src/core/resultados'
import {
  carregarResultado,
  salvarResultado,
  type StorageLocal,
} from '../src/storage/resultados'

function mapaStorage(inicial: Record<string, unknown> = {}): StorageLocal {
  const mapa = new Map(Object.entries(inicial))
  return {
    get: async (chave) => mapa.get(chave),
    set: async (chave, valor) => {
      mapa.set(chave, valor)
    },
  }
}

function resultadoDeTeste(): ResultadoLocal {
  return {
    salvoEm: new Date('2026-09-17T12:00:00Z'),
    origem: 'https://www.facebook.com/ads/library/?q=receitas',
    estado: 'esgotado',
    anuncios: [
      {
        id: 'ad-1',
        iniciouEm: new Date('2026-09-10T12:00:00Z'),
        colacao: 1,
        anunciante: { pageId: 'page-1', pageName: 'Anunciante 1' },
        midias: [],
        plataformas: ['Facebook'],
        ativo: true,
      },
    ],
  }
}

describe('storage dos resultados', () => {
  it('salva usando a chave versionada e lê o resultado hidratado', async () => {
    const storage = mapaStorage()

    await salvarResultado(resultadoDeTeste(), storage)
    const payload = await storage.get(CHAVE_RESULTADO)
    const lido = await carregarResultado(storage)

    expect(payload).toMatchObject({ versao: 1 })
    expect(lido?.anuncios[0].iniciouEm).toBeInstanceOf(Date)
  })

  it('trata storage vazio ou corrompido como ausência de resultado', async () => {
    expect(await carregarResultado(mapaStorage())).toBeNull()
    expect(
      await carregarResultado(mapaStorage({ [CHAVE_RESULTADO]: { versao: 2 } })),
    ).toBeNull()
  })
})
