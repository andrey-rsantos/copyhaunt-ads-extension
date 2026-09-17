import { beforeEach, describe, expect, it, vi } from 'vitest'

const onClicked = vi.hoisted(() => {
  const listeners: Array<(tab: chrome.tabs.Tab) => void> = []
  return {
    listeners,
    addListener: vi.fn((listener: (tab: chrome.tabs.Tab) => void) => {
      listeners.push(listener)
    }),
  }
})
const criarAba = vi.hoisted(() => vi.fn())
const obterAba = vi.hoisted(() => vi.fn())
const enviarParaAba = vi.hoisted(() => vi.fn())
const onUpdated = vi.hoisted(() => {
  const listeners: Array<
    (tabId: number, info: { status?: string }) => void
  > = []
  return {
    listeners,
    addListener: vi.fn((listener: (tabId: number, info: { status?: string }) => void) => {
      listeners.push(listener)
    }),
    removeListener: vi.fn((listener: (tabId: number, info: { status?: string }) => void) => {
      const i = listeners.indexOf(listener)
      if (i >= 0) listeners.splice(i, 1)
    }),
  }
})
const onMessage = vi.hoisted(() => {
  const listeners: Array<
    (mensagem: unknown, remetente: unknown, responder: () => void) => boolean
  > = []
  return {
    listeners,
    addListener: vi.fn(
      (listener: (mensagem: unknown, remetente: unknown, responder: () => void) => boolean) => {
        listeners.push(listener)
      },
    ),
  }
})

vi.hoisted(() => {
  vi.stubGlobal('chrome', {
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onMessage,
      getURL: vi.fn(() => 'chrome-extension://id/src/resultados/index.html'),
    },
    action: { onClicked },
    tabs: { create: criarAba, get: obterAba, sendMessage: enviarParaAba, onUpdated },
  })
})

describe('service worker', () => {
  beforeEach(() => {
    onClicked.listeners.length = 0
    onClicked.addListener.mockClear()
    onMessage.listeners.length = 0
    criarAba.mockReset()
    obterAba.mockReset()
    obterAba.mockResolvedValue({ status: 'loading' })
    enviarParaAba.mockReset()
    onUpdated.listeners.length = 0
    vi.resetModules()
  })

  it('abre resultados quando o ícone da extensão é clicado', async () => {
    await import('../src/background/index')

    expect(onClicked.addListener).toHaveBeenCalledTimes(1)
    onClicked.listeners[0]({} as chrome.tabs.Tab)

    expect(criarAba).toHaveBeenCalledWith({
      url: 'chrome-extension://id/src/resultados/index.html',
    })
  })

  it('abre resultados quando o content script pede por mensagem', async () => {
    await import('../src/background/index')

    const listener = onMessage.listeners[0]
    expect(listener({ tipo: 'abrir-resultados' }, {}, vi.fn())).toBe(false)

    expect(criarAba).toHaveBeenCalledWith({
      url: 'chrome-extension://id/src/resultados/index.html',
    })
  })

  it('ignora mensagens que não conhece sem abrir aba', async () => {
    await import('../src/background/index')

    onMessage.listeners[0]({ tipo: 'outra' }, {}, vi.fn())

    expect(criarAba).not.toHaveBeenCalled()
  })

  it('rejeita origem inválida sem abrir aba', async () => {
    await import('../src/background/index')
    const responder = vi.fn()

    const manterAberto = onMessage.listeners[0]({
      tipo: 'buscar-instagram',
      pageId: '123',
      origem: 'https://evil.test/ads/library/',
    }, {}, responder)

    expect(manterAberto).toBe(true)
    await vi.waitFor(() => expect(responder).toHaveBeenCalledWith({
      ok: false,
      motivo: 'origem-invalida',
    }))
    expect(criarAba).not.toHaveBeenCalled()
  })

  it('abre a Biblioteca em aba inativa e repassa o comando quando ela carrega', async () => {
    criarAba.mockResolvedValue({ id: 41 })
    enviarParaAba.mockResolvedValue({ ok: true, url: null })
    await import('../src/background/index')

    const responder = vi.fn()
    const manterAberto = onMessage.listeners[0]({
      tipo: 'buscar-instagram',
      pageId: '123',
      origem: 'https://www.facebook.com/ads/library/?q=receitas',
    }, {}, responder)

    expect(manterAberto).toBe(true)
    expect(criarAba).toHaveBeenCalledWith({
      url: 'https://www.facebook.com/ads/library/?q=receitas',
      active: false,
    })

    await vi.waitFor(() => expect(onUpdated.listeners).toHaveLength(1))
    expect(enviarParaAba).not.toHaveBeenCalled()
    onUpdated.listeners[0](99, { status: 'complete' })
    onUpdated.listeners[0](41, { status: 'loading' })
    expect(enviarParaAba).not.toHaveBeenCalled()
    onUpdated.listeners[0](41, { status: 'complete' })

    await vi.waitFor(() => expect(enviarParaAba).toHaveBeenCalledWith(
      41,
      { tipo: 'buscar-instagram', pageId: '123' },
    ))
    await vi.waitFor(() => expect(responder).toHaveBeenCalledWith({ ok: true, url: null }))
    expect(onUpdated.listeners).toHaveLength(0)
  })

  it('envia imediatamente quando a aba já estava completa antes do listener', async () => {
    criarAba.mockResolvedValue({ id: 42 })
    obterAba.mockResolvedValue({ id: 42, status: 'complete' })
    enviarParaAba.mockResolvedValue({ ok: true, url: null })
    await import('../src/background/index')

    const responder = vi.fn()
    onMessage.listeners[0]({
      tipo: 'buscar-instagram',
      pageId: '123',
      origem: 'https://www.facebook.com/ads/library/?q=receitas',
    }, {}, responder)

    await vi.waitFor(() => expect(enviarParaAba).toHaveBeenCalledWith(
      42,
      { tipo: 'buscar-instagram', pageId: '123' },
    ))
    expect(responder).toHaveBeenCalledWith({ ok: true, url: null })
  })

  it('traduz falha ao criar a aba e falha no envio', async () => {
    criarAba.mockRejectedValue(new Error('sem janela'))
    await import('../src/background/index')
    const responder = vi.fn()

    onMessage.listeners[0]({
      tipo: 'buscar-instagram',
      pageId: '123',
      origem: 'https://www.facebook.com/ads/library/',
    }, {}, responder)
    await vi.waitFor(() => expect(responder).toHaveBeenCalledWith({
      ok: false,
      motivo: 'aba-indisponivel',
    }))

    criarAba.mockResolvedValue({ id: 7 })
    enviarParaAba.mockRejectedValue(new Error('sem receptor'))
    const responder2 = vi.fn()
    onMessage.listeners[0]({
      tipo: 'buscar-instagram',
      pageId: '123',
      origem: 'https://www.facebook.com/ads/library/',
    }, {}, responder2)
    await vi.waitFor(() => expect(onUpdated.listeners).toHaveLength(1))
    onUpdated.listeners[0](7, { status: 'complete' })
    await vi.waitFor(() => expect(responder2).toHaveBeenCalledWith({
      ok: false,
      motivo: 'conteudo-indisponivel',
    }))
  })
})
