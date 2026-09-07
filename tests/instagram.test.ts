import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buscarInstagram,
  definirDocIdAnunciante,
  instagramConhecido,
  limparCacheInstagram,
  type Dependencias,
} from '../src/content/instagram'

const PAGE_ID = '378128628724966'
const DOC_ID = '26617181747964058'
const HTML_COM_LSD = `["LSD",[],{"token":"AdLsdToken"},323]`

function resposta(corpo: unknown, ok = true) {
  const texto = typeof corpo === 'string' ? corpo : JSON.stringify(corpo)
  return { ok, text: async () => texto } as unknown as Response
}

const RESPOSTA_BOA = [
  JSON.stringify({ data: { viewer: { actor: { __typename: 'LoggedOutUser' } } } }),
  JSON.stringify({
    data: {
      ad_library_page_info: {
        page_info: { page_name: 'Renan Botelho Dr', ig_username: 'renanbotelhodr' },
      },
    },
  }),
].join('\n')

function deps(extra: Partial<Dependencias> = {}): Dependencias {
  return {
    buscar: vi.fn(async () => resposta(RESPOSTA_BOA)),
    html: () => HTML_COM_LSD,
    ...extra,
  }
}

beforeEach(() => {
  // Cache de módulo: sem isto um teste contamina o seguinte.
  limparCacheInstagram()
  definirDocIdAnunciante(DOC_ID)
})

describe('buscarInstagram', () => {
  it('devolve a URL do perfil quando a resposta traz o handle', async () => {
    expect(await buscarInstagram(PAGE_ID, deps())).toBe(
      'https://www.instagram.com/renanbotelhodr',
    )
  })

  it('acha o handle em qualquer profundidade do envelope', async () => {
    // O caminho exato dentro de `data` não foi medido, e a Meta reorganiza
    // envelope com frequência. Procurar a chave sobrevive a isso; um caminho
    // fixo errado falharia em silêncio para sempre.
    const fundo = { a: [{ b: { c: { ig_username: 'fundo' } } }] }
    const d = deps({ buscar: vi.fn(async () => resposta(fundo)) })
    expect(await buscarInstagram(PAGE_ID, d)).toBe(
      'https://www.instagram.com/fundo',
    )
  })

  it('acha o handle mesmo quando o corpo vem em várias linhas JSON', async () => {
    expect(await buscarInstagram(PAGE_ID, deps())).toBe(
      'https://www.instagram.com/renanbotelhodr',
    )
  })

  it('não manda cookie nem token de sessão', async () => {
    const buscar = vi.fn(async () => resposta(RESPOSTA_BOA))
    await buscarInstagram(PAGE_ID, deps({ buscar }))

    const [, init] = buscar.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.credentials).toBe('omit')

    const corpo = new URLSearchParams(init.body as string)
    expect(corpo.get('lsd')).toBe('AdLsdToken')
    expect(corpo.get('token_de_sessao')).toBeNull()
  })

  it('manda o doc_id da config e o anunciante pedido', async () => {
    const buscar = vi.fn(async () => resposta(RESPOSTA_BOA))
    await buscarInstagram(PAGE_ID, deps({ buscar }))

    const [, init] = buscar.mock.calls[0] as unknown as [string, RequestInit]
    const corpo = new URLSearchParams(init.body as string)
    expect(corpo.get('doc_id')).toBe(DOC_ID)
    expect(JSON.parse(corpo.get('variables') as string)).toMatchObject({
      viewAllPageID: PAGE_ID,
      isAboutTab: true,
      fetchPageInfo: true,
      isLandingPage: false,
      countries: ['BR'],
    })
  })

  it('desiste sem lsd, e não chega a pedir nada', async () => {
    const buscar = vi.fn(async () => resposta(RESPOSTA_BOA))
    expect(await buscarInstagram(PAGE_ID, deps({ buscar, html: () => '<html></html>' })))
      .toBeNull()
    expect(buscar).not.toHaveBeenCalled()
  })

  it('devolve null quando o anunciante não tem Instagram vinculado', async () => {
    const semIg = JSON.stringify({
      data: { ad_library_page_info: { page_info: { page_name: 'Susana Ateliê' } } },
    })
    expect(await buscarInstagram(PAGE_ID, deps({ buscar: async () => resposta(semIg) })))
      .toBeNull()
  })

  it('não quebra quando uma das linhas não é JSON', async () => {
    const sujo = `for (;;);\n${RESPOSTA_BOA}`
    expect(await buscarInstagram(PAGE_ID, deps({ buscar: async () => resposta(sujo) })))
      .toBe('https://www.instagram.com/renanbotelhodr')
  })
})

describe('as travas do spec', () => {
  it('não sai requisição nenhuma sem doc_id na config', async () => {
    // Apagar o campo do arquivo hospedado desliga o recurso. Esta é a trava
    // que faz esse desligamento valer.
    definirDocIdAnunciante(undefined)
    const d = deps()
    expect(await buscarInstagram(PAGE_ID, d)).toBeNull()
    expect(d.buscar).not.toHaveBeenCalled()
  })

  it('não sai requisição nenhuma sem lsd', async () => {
    const d = deps({ html: () => '<html>deslogado</html>' })
    expect(await buscarInstagram(PAGE_ID, d)).toBeNull()
    expect(d.buscar).not.toHaveBeenCalled()
  })

  it('pergunta uma vez só por anunciante', async () => {
    const d = deps()
    await buscarInstagram(PAGE_ID, d)
    await buscarInstagram(PAGE_ID, d)
    await buscarInstagram(PAGE_ID, d)
    expect(d.buscar).toHaveBeenCalledTimes(1)
  })

  it('cliques repetidos antes da resposta chegar dividem a mesma requisição', async () => {
    // O cache só grava quando a resposta chega. Nesse intervalo o item ainda
    // se oferece para buscar, e quem clica duas vezes é justamente o usuário
    // impaciente — a trava tem que valer também durante a espera.
    let liberar!: (r: Response) => void
    const buscar = vi.fn(
      () => new Promise<Response>((ok) => (liberar = ok)),
    ) as unknown as typeof fetch
    const d = deps({ buscar })

    const primeira = buscarInstagram(PAGE_ID, d)
    const segunda = buscarInstagram(PAGE_ID, d)
    liberar(resposta(RESPOSTA_BOA))

    expect(await primeira).toBe('https://www.instagram.com/renanbotelhodr')
    expect(await segunda).toBe('https://www.instagram.com/renanbotelhodr')
    expect(d.buscar).toHaveBeenCalledTimes(1)
  })

  it('guarda também o fracasso, para insistir no clique não virar repetição', async () => {
    const d = deps({ buscar: vi.fn(async () => resposta({ data: {} })) })
    expect(await buscarInstagram(PAGE_ID, d)).toBeNull()
    expect(await buscarInstagram(PAGE_ID, d)).toBeNull()
    expect(d.buscar).toHaveBeenCalledTimes(1)
  })

  it('anunciantes diferentes são perguntas diferentes', async () => {
    const d = deps()
    await buscarInstagram(PAGE_ID, d)
    await buscarInstagram('999999999999999', d)
    expect(d.buscar).toHaveBeenCalledTimes(2)
  })
})

describe('falha silenciosa', () => {
  it.each([
    ['a resposta não é ok', () => resposta(RESPOSTA_BOA, false)],
    ['não há handle na resposta', () => resposta({ data: { page: null } })],
    ['o handle vem vazio', () => resposta({ ig_username: '' })],
    ['o corpo não é JSON', () => resposta('<html>erro</html>')],
    ['a rede cai', () => { throw new Error('sem rede') }],
  ])('devolve nulo, sem lançar, quando %s', async (_caso, montar) => {
    const d = deps({ buscar: vi.fn(async () => montar()) })
    await expect(buscarInstagram(PAGE_ID, d)).resolves.toBeNull()
  })
})

describe('instagramConhecido', () => {
  it('é indefinido antes de perguntar, e nisso difere de não ter achado', async () => {
    expect(instagramConhecido(PAGE_ID)).toBeUndefined()
  })

  it('guarda o achado', async () => {
    await buscarInstagram(PAGE_ID, deps())
    expect(instagramConhecido(PAGE_ID)).toBe('https://www.instagram.com/renanbotelhodr')
  })

  it('guarda o nulo de quem já foi perguntado e não deu', async () => {
    await buscarInstagram(PAGE_ID, deps({ buscar: vi.fn(async () => resposta({})) }))
    expect(instagramConhecido(PAGE_ID)).toBeNull()
  })
})
