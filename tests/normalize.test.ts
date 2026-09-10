import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizarBusca } from '../src/core/normalize'

const PASTA = resolve(import.meta.dirname, 'fixtures')

function carregar(arquivo: string): unknown {
  const bruto = readFileSync(join(PASTA, arquivo), 'utf8').replace(
    /^\s*for\s*\(\s*;\s*;\s*\)\s*;/,
    '',
  )
  return JSON.parse(bruto)
}

describe('normalizarBusca com payload sintético', () => {
  it('devolve lista vazia para corpo que não é do formato esperado', () => {
    expect(normalizarBusca({})).toEqual([])
    expect(normalizarBusca(null)).toEqual([])
    expect(normalizarBusca('texto')).toEqual([])
  })

  it('converte start_date de epoch em segundos para Date', () => {
    const corpo = {
      data: {
        ad_library_main: {
          search_results_connection: {
            edges: [
              {
                node: {
                  collated_results: [
                    {
                      ad_archive_id: '123',
                      start_date: 1757574000,
                      page_id: '9',
                      page_name: 'Alguém',
                      is_active: true,
                      publisher_platform: ['FACEBOOK'],
                      snapshot: {},
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }
    const [ad] = normalizarBusca(corpo)
    expect(ad.iniciouEm.getTime()).toBe(1757574000 * 1000)
  })

  it('assume colação 1 quando collation_count falta', () => {
    // Visto em 1 de 27 anúncios reais: o campo simplesmente não vem.
    const corpo = {
      data: {
        ad_library_main: {
          search_results_connection: {
            edges: [
              {
                node: {
                  collated_results: [
                    {
                      ad_archive_id: '123',
                      start_date: 1757574000,
                      page_id: '9',
                      page_name: 'Alguém',
                      snapshot: {},
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }
    expect(normalizarBusca(corpo)[0].colacao).toBe(1)
  })

  it('lê o collation_id quando ele vem', () => {
    const corpo = {
      data: { ad_library_main: { search_results_connection: { edges: [
        { node: { collated_results: [{
          ad_archive_id: '1',
          page_id: 'p1',
          page_name: 'A',
          start_date: 1754049600,
          collation_count: null,
          collation_id: '1541173110816865',
          snapshot: {},
        }] } },
      ] } } },
    }
    const [ad] = normalizarBusca(corpo)
    expect(ad.colacaoId).toBe('1541173110816865')
    expect(ad.colacao).toBe(1)
  })

  it('lê o texto de snapshot.body.text, que é objeto e não string', () => {
    const corpo = {
      data: {
        ad_library_main: {
          search_results_connection: {
            edges: [
              {
                node: {
                  collated_results: [
                    {
                      ad_archive_id: '123',
                      start_date: 1757574000,
                      page_id: '9',
                      page_name: 'Alguém',
                      snapshot: { body: { text: 'Compre já' } },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }
    expect(normalizarBusca(corpo)[0].texto).toBe('Compre já')
  })

  it('descarta anúncio sem ad_archive_id em vez de derrubar o lote', () => {
    const corpo = {
      data: {
        ad_library_main: {
          search_results_connection: {
            edges: [
              { node: { collated_results: [{ snapshot: {} }] } },
              {
                node: {
                  collated_results: [
                    {
                      ad_archive_id: 'bom',
                      start_date: 1757574000,
                      page_id: '9',
                      page_name: 'Alguém',
                      snapshot: {},
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }
    const ads = normalizarBusca(corpo)
    expect(ads).toHaveLength(1)
    expect(ads[0].id).toBe('bom')
  })

  it('prefere video_hd_url e cai para video_sd_url', () => {
    const corpo = {
      data: {
        ad_library_main: {
          search_results_connection: {
            edges: [
              {
                node: {
                  collated_results: [
                    {
                      ad_archive_id: '1',
                      start_date: 1757574000,
                      page_id: '9',
                      page_name: 'A',
                      snapshot: {
                        videos: [
                          { video_hd_url: 'hd.mp4', video_sd_url: 'sd.mp4' },
                          { video_hd_url: null, video_sd_url: 'so-sd.mp4' },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }
    const [ad] = normalizarBusca(corpo)
    expect(ad.midias).toEqual([
      { formato: 'video', alta: 'hd.mp4', baixa: 'sd.mp4' },
      { formato: 'video', alta: 'so-sd.mp4', baixa: 'so-sd.mp4' },
    ])
  })
})

describe('normalizarBusca contra as fixtures reais', () => {
  const arquivos = ['payload-01.json', 'payload-02.json', 'payload-03.json']

  it('extrai anúncios de todas as fixtures', () => {
    for (const arquivo of arquivos) {
      const ads = normalizarBusca(carregar(arquivo))
      expect(ads.length, `${arquivo} não rendeu anúncio`).toBeGreaterThan(0)
    }
  })

  it('todo anúncio real tem os campos obrigatórios preenchidos', () => {
    for (const arquivo of arquivos) {
      for (const ad of normalizarBusca(carregar(arquivo))) {
        expect(ad.id, `${arquivo}: id vazio`).toBeTruthy()
        expect(ad.anunciante.pageId, `${arquivo}: pageId vazio`).toBeTruthy()
        expect(ad.anunciante.pageName, `${arquivo}: pageName vazio`).toBeTruthy()
        expect(ad.colacao).toBeGreaterThanOrEqual(1)
        expect(Number.isNaN(ad.iniciouEm.getTime())).toBe(false)
      }
    }
  })

  it('nenhuma URL de mídia vem vazia', () => {
    for (const arquivo of arquivos) {
      for (const ad of normalizarBusca(carregar(arquivo))) {
        for (const m of ad.midias) {
          expect(m.alta, `${arquivo}: mídia sem url`).toBeTruthy()
          expect(m.baixa, `${arquivo}: mídia sem url leve`).toBeTruthy()
        }
      }
    }
  })

  it('relata o que foi extraído das fixtures reais', () => {
    let total = 0
    let comVideo = 0
    let comImagem = 0
    let comDestino = 0
    let comTexto = 0
    const colacoes: number[] = []

    for (const arquivo of arquivos) {
      for (const ad of normalizarBusca(carregar(arquivo))) {
        total += 1
        if (ad.midias.some((m) => m.formato === 'video')) comVideo += 1
        if (ad.midias.some((m) => m.formato === 'imagem')) comImagem += 1
        if (ad.destino) comDestino += 1
        if (ad.texto) comTexto += 1
        colacoes.push(ad.colacao)
      }
    }

    console.log(
      `anúncios reais normalizados: ${total} | com vídeo: ${comVideo} | ` +
        `com imagem: ${comImagem} | com destino: ${comDestino} | ` +
        `com texto: ${comTexto} | colação máxima: ${Math.max(...colacoes)}`,
    )

    expect(total).toBeGreaterThan(20)
  })

  it('lê a descrição do link quando a Meta a envia', () => {
    const ads = normalizarBusca(
      JSON.parse(readFileSync(join(PASTA, 'payload-01.json'), 'utf8')),
    )
    const comDescricao = ads.filter((a) => a.descricao)
    // Nem todo anúncio traz link_description: medido, 13 de 30 no lote do HTML.
    expect(comDescricao.length).toBeGreaterThan(0)
    for (const a of comDescricao) {
      expect(typeof a.descricao).toBe('string')
      expect(a.descricao!.length).toBeGreaterThan(0)
    }
  })
})

describe('normalizarBusca com criativos em cards', () => {
  function comCards(cards: unknown[]) {
    return {
      data: {
        ad_library_main: {
          search_results_connection: {
            edges: [
              {
                node: {
                  collated_results: [
                    {
                      ad_archive_id: '1',
                      start_date: 1757574000,
                      page_id: '9',
                      page_name: 'A',
                      snapshot: { display_format: 'DCO', cards },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }
  }

  it('extrai imagem de dentro de cards', () => {
    // DCO e CAROUSEL guardam o criativo em cards[], não em images[].
    // São 16 dos 27 anúncios reais das fixtures.
    const [ad] = normalizarBusca(
      comCards([
        { original_image_url: 'grande.jpg', resized_image_url: 'peq.jpg' },
      ]),
    )
    expect(ad.midias).toEqual([
      { formato: 'imagem', alta: 'grande.jpg', baixa: 'peq.jpg' },
    ])
  })

  it('extrai vídeo de dentro de cards', () => {
    const [ad] = normalizarBusca(
      comCards([{ video_hd_url: 'hd.mp4', video_sd_url: 'sd.mp4' }]),
    )
    expect(ad.midias).toEqual([
      { formato: 'video', alta: 'hd.mp4', baixa: 'sd.mp4' },
    ])
  })

  it('junta as mídias de todos os cards', () => {
    const [ad] = normalizarBusca(
      comCards([
        { original_image_url: 'a.jpg' },
        { original_image_url: 'b.jpg' },
        { video_hd_url: 'c.mp4' },
      ]),
    )
    expect(ad.midias).toHaveLength(3)
  })

  it('ignora card sem mídia nenhuma', () => {
    const [ad] = normalizarBusca(
      comCards([{ title: 'só texto' }, { original_image_url: 'a.jpg' }]),
    )
    expect(ad.midias).toHaveLength(1)
  })
})

describe('cobertura de mídia nas fixtures reais', () => {
  it('todo anúncio real tem pelo menos uma mídia', () => {
    // "Baixar criativo" é funcionalidade central. Um anúncio sem mídia
    // extraída é um botão que não funciona.
    const semMidia: string[] = []
    for (const arquivo of ['payload-01.json', 'payload-02.json', 'payload-03.json']) {
      for (const ad of normalizarBusca(carregar(arquivo))) {
        if (ad.midias.length === 0) semMidia.push(`${arquivo}:${ad.id}`)
      }
    }
    expect(semMidia, `sem mídia: ${semMidia.join(' ')}`).toEqual([])
  })
})
