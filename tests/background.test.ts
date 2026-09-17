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
    tabs: { create: criarAba },
  })
})

describe('service worker', () => {
  beforeEach(() => {
    onClicked.listeners.length = 0
    onClicked.addListener.mockClear()
    onMessage.listeners.length = 0
    criarAba.mockClear()
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
})
