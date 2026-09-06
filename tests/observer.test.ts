// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { observarGrade } from '../src/content/observer'

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
})

/** MutationObserver entrega em microtask; é preciso cedê-la antes do timer. */
async function deixarObservar() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('observarGrade', () => {
  it('avisa quando um card entra na grade', async () => {
    const grade = document.createElement('div')
    document.body.appendChild(grade)
    const aoMudar = vi.fn()
    observarGrade(grade, aoMudar, 250)

    grade.appendChild(document.createElement('div'))
    await deixarObservar()
    vi.advanceTimersByTime(250)

    expect(aoMudar).toHaveBeenCalledTimes(1)
  })

  it('agrupa muitas mudanças num único aviso', async () => {
    // A Meta muda o DOM dezenas de vezes por rolagem. Repintar a cada
    // mutação seria repintar durante a própria repintura.
    const grade = document.createElement('div')
    document.body.appendChild(grade)
    const aoMudar = vi.fn()
    observarGrade(grade, aoMudar, 250)

    for (let i = 0; i < 20; i += 1) {
      grade.appendChild(document.createElement('div'))
    }
    await deixarObservar()
    vi.advanceTimersByTime(250)

    expect(aoMudar).toHaveBeenCalledTimes(1)
  })

  it('avisa de novo depois que a espera passa', async () => {
    const grade = document.createElement('div')
    document.body.appendChild(grade)
    const aoMudar = vi.fn()
    observarGrade(grade, aoMudar, 250)

    grade.appendChild(document.createElement('div'))
    await deixarObservar()
    vi.advanceTimersByTime(250)

    grade.appendChild(document.createElement('div'))
    await deixarObservar()
    vi.advanceTimersByTime(250)

    expect(aoMudar).toHaveBeenCalledTimes(2)
  })

  it('enxerga mudança em profundidade, não só nos filhos diretos', async () => {
    const grade = document.createElement('div')
    const nivel = document.createElement('div')
    grade.appendChild(nivel)
    document.body.appendChild(grade)
    const aoMudar = vi.fn()
    observarGrade(grade, aoMudar, 250)

    nivel.appendChild(document.createElement('span'))
    await deixarObservar()
    vi.advanceTimersByTime(250)

    expect(aoMudar).toHaveBeenCalledTimes(1)
  })

  it('parar cancela o aviso ainda pendente', async () => {
    const grade = document.createElement('div')
    document.body.appendChild(grade)
    const aoMudar = vi.fn()
    const obs = observarGrade(grade, aoMudar, 250)

    grade.appendChild(document.createElement('div'))
    await deixarObservar()
    obs.parar()
    vi.advanceTimersByTime(250)

    expect(aoMudar).not.toHaveBeenCalled()
  })

  it('depois de parar, mudança nova não avisa', async () => {
    const grade = document.createElement('div')
    document.body.appendChild(grade)
    const aoMudar = vi.fn()
    const obs = observarGrade(grade, aoMudar, 250)
    obs.parar()

    grade.appendChild(document.createElement('div'))
    await deixarObservar()
    vi.advanceTimersByTime(250)

    expect(aoMudar).not.toHaveBeenCalled()
  })
})
