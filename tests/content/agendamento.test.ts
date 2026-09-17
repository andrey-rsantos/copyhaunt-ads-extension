import { describe, expect, it, vi } from 'vitest'
import { criarAgendadorRepintura } from '../../src/content/agendamento'

describe('criarAgendadorRepintura', () => {
  it('consolida várias solicitações antes do frame', () => {
    const repintar = vi.fn()
    const callbacks: Array<() => void> = []
    const agendar = criarAgendadorRepintura(repintar, callback => {
      callbacks.push(callback)
    })

    agendar()
    agendar()
    agendar()

    expect(callbacks).toHaveLength(1)
    expect(repintar).not.toHaveBeenCalled()

    callbacks[0]()

    expect(repintar).toHaveBeenCalledOnce()
  })

  it('permite uma nova repintura depois que o frame termina', () => {
    const repintar = vi.fn()
    const callbacks: Array<() => void> = []
    const agendar = criarAgendadorRepintura(repintar, callback => {
      callbacks.push(callback)
    })

    agendar()
    callbacks[0]()
    agendar()

    expect(callbacks).toHaveLength(2)
    callbacks[1]()
    expect(repintar).toHaveBeenCalledTimes(2)
  })

  it('agenda o próximo frame quando a própria repintura solicita de novo', () => {
    const callbacks: Array<() => void> = []
    let agendar: () => void = () => {}
    let chamadas = 0
    const repintar = vi.fn(() => {
      chamadas++
      if (chamadas === 1) agendar()
    })
    agendar = criarAgendadorRepintura(repintar, callback => {
      callbacks.push(callback)
    })

    agendar()
    expect(callbacks).toHaveLength(1)

    callbacks[0]()
    expect(callbacks).toHaveLength(2)
    expect(repintar).toHaveBeenCalledTimes(1)

    callbacks[1]()
    expect(repintar).toHaveBeenCalledTimes(2)
  })
})
