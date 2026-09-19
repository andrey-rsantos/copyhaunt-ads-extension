import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAVE_AVALIACAO, INTERVALO_AVALIACAO_MS } from '../src/core/avaliacao'

const AGORA = new Date('2026-09-19T12:00:00Z')

const infraestrutura = vi.hoisted(() => {
  const armazenamento = new Map<string, unknown>()
  const onMessage = {
    listeners: [] as Array<(mensagem: unknown, remetente: unknown, responder: (valor: unknown) => void) => boolean>,
    addListener: vi.fn((listener: (mensagem: unknown, remetente: unknown, responder: (valor: unknown) => void) => boolean) => {
      onMessage.listeners.push(listener)
    }),
  }
  const onInstalled = { addListener: vi.fn() }
  const onClicked = { addListener: vi.fn() }
  const onUpdated = { addListener: vi.fn(), removeListener: vi.fn() }
  const storageLocal = {
    get: vi.fn(async (chave: string) => ({ [chave]: armazenamento.get(chave) })),
    set: vi.fn(async (valores: Record<string, unknown>) => {
      for (const [chave, valor] of Object.entries(valores)) armazenamento.set(chave, valor)
    }),
  }

  vi.stubGlobal('chrome', {
    runtime: { onInstalled, onMessage, getURL: vi.fn((path: string) => 'chrome-extension://id/' + path) },
    action: { onClicked },
    tabs: {
      create: vi.fn(),
      get: vi.fn(),
      sendMessage: vi.fn(),
      onUpdated,
    },
    storage: { local: storageLocal },
  })

  return { armazenamento, onMessage }
})

describe('service worker e pedido de avaliação', () => {
  beforeEach(() => {
    infraestrutura.armazenamento.clear()
    infraestrutura.onMessage.listeners.length = 0
    vi.resetModules()
  })

  it('serializa dois pedidos vencidos e concede o intervalo a apenas uma aba', async () => {
    infraestrutura.armazenamento.set(CHAVE_AVALIACAO, {
      versao: 1,
      primeiroUsoEm: new Date(AGORA.getTime() - INTERVALO_AVALIACAO_MS).toISOString(),
      naoMostrarNovamente: false,
    })
    await import('../src/background/index')

    const listener = infraestrutura.onMessage.listeners[0]
    const primeiraResposta = vi.fn()
    const segundaResposta = vi.fn()
    const mensagem = { tipo: 'considerar-avaliacao', agora: AGORA.toISOString() }

    expect(listener(mensagem, {}, primeiraResposta)).toBe(true)
    expect(listener(mensagem, {}, segundaResposta)).toBe(true)

    await vi.waitFor(() => expect(primeiraResposta).toHaveBeenCalledWith(true))
    await vi.waitFor(() => expect(segundaResposta).toHaveBeenCalledWith(false))
  })
})
