import { describe, expect, it, vi } from 'vitest'
import {
  aplicarPatch,
  ehEndpointDeAnuncios,
  removerExcludedIds,
} from '../src/interceptor/xhr-patch'

/** XMLHttpRequest falso: o mínimo que o patch precisa enxergar. */
function criarXhrFalso() {
  const ouvintes: Record<string, Array<() => void>> = {}
  class XhrFalso {
    responseURL = ''
    responseText = ''
    responseType = ''
    abriuCom: unknown[] = []
    open(...args: unknown[]) {
      this.abriuCom = args
    }
    send(_corpo?: string) {}
    addEventListener(evento: string, fn: () => void) {
      ouvintes[evento] = ouvintes[evento] ?? []
      ouvintes[evento].push(fn)
    }
    /** Simula a resposta chegando. */
    responder(url: string, texto: string) {
      this.responseURL = url
      this.responseText = texto
      for (const fn of ouvintes.load ?? []) fn.call(this)
    }
  }
  return XhrFalso
}

describe('removerExcludedIds', () => {
  it('remove o parâmetro excluded_ids da query', () => {
    const url = removerExcludedIds(
      'https://x.com/search_ads/?count=30&excluded_ids[0]=123&q=teste',
    )
    expect(url).not.toContain('excluded_ids')
    expect(url).toContain('count=30')
    expect(url).toContain('q=teste')
  })

  it('preserva URL que não tem o parâmetro', () => {
    const url = 'https://x.com/search_ads/?count=30'
    expect(removerExcludedIds(url)).toBe(url)
  })

  it('não quebra com URL sem query', () => {
    expect(removerExcludedIds('https://x.com/search_ads/')).toBe(
      'https://x.com/search_ads/',
    )
  })
})

describe('aplicarPatch', () => {
  it('entrega url e corpo quando a resposta chega', () => {
    const Xhr = criarXhrFalso()
    const capturado = vi.fn()
    aplicarPatch({ prototype: Xhr.prototype } as never, capturado)

    const req = new Xhr()
    req.open('GET', 'https://www.facebook.com/api/graphql/')
    req.send()
    req.responder('https://www.facebook.com/api/graphql/', '{"data":1}')

    expect(capturado).toHaveBeenCalledWith({
      url: 'https://www.facebook.com/api/graphql/',
      corpo: '{"data":1}',
    })
  })

  it('remove excluded_ids na abertura da requisição', () => {
    const Xhr = criarXhrFalso()
    aplicarPatch({ prototype: Xhr.prototype } as never, () => {})

    const req = new Xhr()
    req.open('GET', 'https://x.com/search_ads/?excluded_ids[0]=9&count=30')

    expect(String(req.abriuCom[1])).not.toContain('excluded_ids')
  })

  it('não deixa o patch ser desfeito', () => {
    const Xhr = criarXhrFalso()
    aplicarPatch({ prototype: Xhr.prototype } as never, () => {})
    const descritor = Object.getOwnPropertyDescriptor(Xhr.prototype, 'send')
    expect(descritor?.writable).toBe(false)
  })

  it('um erro no callback não derruba a requisição', () => {
    const Xhr = criarXhrFalso()
    aplicarPatch({ prototype: Xhr.prototype } as never, () => {
      throw new Error('falha no consumidor')
    })

    const req = new Xhr()
    req.open('GET', 'https://x.com/api/graphql/')
    req.send()
    expect(() => req.responder('https://x.com/api/graphql/', '{}')).not.toThrow()
  })
})

describe('ehEndpointDeAnuncios', () => {
  it('reconhece o endpoint GraphQL', () => {
    expect(
      ehEndpointDeAnuncios('https://www.facebook.com/api/graphql/?doc_id=1'),
    ).toBe(true)
  })

  it('reconhece o endpoint de busca', () => {
    expect(ehEndpointDeAnuncios('https://x.com/search_ads/?q=1')).toBe(true)
  })

  it('rejeita a telemetria do Facebook', () => {
    // /ajax/bz dispara o tempo todo. Sem este filtro, cada disparo atravessa
    // a fronteira entre os mundos carregando corpo de resposta junto.
    expect(ehEndpointDeAnuncios('https://www.facebook.com/ajax/bz')).toBe(false)
  })

  it('rejeita qualquer outro caminho', () => {
    expect(ehEndpointDeAnuncios('https://www.facebook.com/ajax/qm/')).toBe(false)
  })
})
