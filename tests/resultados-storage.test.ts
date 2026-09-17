import { describe, expect, it, vi } from 'vitest'
import {
  CHAVE_RESULTADO,
  serializarResultado,
  type ResultadoLocal,
} from '../src/core/resultados'
import type { Ad } from '../src/core/types'
import {
  atualizarInstagramResultado,
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

function anuncio(opcoes: Partial<Ad> = {}): Ad {
  return {
    id: 'ad-1',
    iniciouEm: new Date('2026-09-10T12:00:00Z'),
    colacao: 1,
    anunciante: { pageId: 'page-1', pageName: 'Anunciante 1' },
    texto: 'Texto do anúncio',
    midias: [],
    plataformas: ['Facebook'],
    ativo: true,
    ...opcoes,
  }
}

function resultadoDeTeste(opcoes: Partial<ResultadoLocal> = {}): ResultadoLocal {
  return {
    salvoEm: new Date('2026-09-17T12:00:00Z'),
    origem: 'https://www.facebook.com/ads/library/?q=receitas',
    estado: 'esgotado',
    anuncios: [anuncio()],
    ...opcoes,
  }
}

function storageCom(resultado: ResultadoLocal | null): StorageLocal {
  return mapaStorage(resultado ? { [CHAVE_RESULTADO]: serializarResultado(resultado) } : {})
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

describe('atualizarInstagramResultado', () => {
  const tres = () => resultadoDeTeste({
    anuncios: [
      anuncio({ id: 'a1', anunciante: { pageId: 'p1', pageName: 'Página 1' } }),
      anuncio({ id: 'a2', anunciante: { pageId: 'p1', pageName: 'Página 1' } }),
      anuncio({ id: 'b1', anunciante: { pageId: 'p2', pageName: 'Página 2' } }),
    ],
  })

  it('atualiza todos os anúncios do anunciante e preserva campos', async () => {
    const resultado = tres()
    const storage = storageCom(resultado)

    await expect(atualizarInstagramResultado(
      'p1',
      'https://www.instagram.com/oficial',
      storage,
    )).resolves.toBe(true)

    const atualizado = await carregarResultado(storage)
    expect(atualizado?.anuncios[0].anunciante.instagram).toBe(
      'https://www.instagram.com/oficial',
    )
    expect(atualizado?.anuncios[1].anunciante.instagram).toBe(
      'https://www.instagram.com/oficial',
    )
    expect(atualizado?.anuncios[2].anunciante.instagram).toBeUndefined()
    expect(atualizado?.anuncios[0].texto).toBe(resultado.anuncios[0].texto)
    expect(atualizado?.estado).toBe(resultado.estado)
    expect(atualizado?.salvoEm).toEqual(resultado.salvoEm)
  })

  it('não cria resultado quando storage está vazio ou pageId não existe', async () => {
    const vazio = storageCom(null)
    expect(await atualizarInstagramResultado(
      'p1',
      'https://www.instagram.com/oficial',
      vazio,
    )).toBe(false)
    expect(await vazio.get(CHAVE_RESULTADO)).toBeUndefined()

    const semPagina = storageCom(tres())
    const antes = await semPagina.get(CHAVE_RESULTADO)
    expect(await atualizarInstagramResultado(
      'p9',
      'https://www.instagram.com/oficial',
      semPagina,
    )).toBe(false)
    expect(await semPagina.get(CHAVE_RESULTADO)).toBe(antes)
  })

  it('serializa atualizações concorrentes sem perder nenhuma', async () => {
    const storage = storageCom(tres())

    await Promise.all([
      atualizarInstagramResultado('p1', 'https://www.instagram.com/um', storage),
      atualizarInstagramResultado('p2', 'https://www.instagram.com/dois', storage),
    ])

    const atualizado = await carregarResultado(storage)
    expect(atualizado?.anuncios.map((a) => a.anunciante.instagram)).toEqual([
      'https://www.instagram.com/um',
      'https://www.instagram.com/um',
      'https://www.instagram.com/dois',
    ])
  })

  it('deixa a rejeição do storage subir', async () => {
    const storage: StorageLocal = {
      get: async () => serializarResultado(tres()),
      set: vi.fn(async () => { throw new Error('quota') }),
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      atualizarInstagramResultado('p1', 'https://www.instagram.com/um', storage),
    ).rejects.toThrow('quota')
  })
})
