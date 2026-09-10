import { describe, expect, it, vi } from 'vitest'
import { createMessage } from '../src/core/messages'
import { instalarConfirmacao } from '../src/interceptor/handshake'

describe('handshake entre os mundos', () => {
  function montar() {
    const proprio = {}
    let listener: ((evento: MessageEvent) => void) | undefined
    const postar = vi.fn()
    instalarConfirmacao(
      (recebido) => { listener = recebido },
      postar,
      proprio,
    )
    return { proprio, postar, enviar: (source: unknown, data: unknown) => {
      listener?.({ source, data } as MessageEvent)
    } }
  }

  it('confirma imediatamente ao instalar', () => {
    const { postar } = montar()
    expect(postar).toHaveBeenCalledTimes(1)
  })

  it('confirma novamente quando o content script anuncia que está pronto', () => {
    const { proprio, postar, enviar } = montar()
    enviar(proprio, createMessage('content-ready', {}))
    expect(postar).toHaveBeenCalledTimes(2)
  })

  it('ignora mensagem de outra janela ou sem o namespace', () => {
    const { proprio, postar, enviar } = montar()
    enviar({}, createMessage('content-ready', {}))
    enviar(proprio, { kind: 'content-ready' })
    expect(postar).toHaveBeenCalledTimes(1)
  })
})
