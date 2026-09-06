import { describe, expect, it } from 'vitest'
import { relogioDeTeste } from '../src/core/clock'

describe('relogioDeTeste', () => {
  it('começa no instante dado', () => {
    const r = relogioDeTeste(new Date('2026-09-06T12:00:00Z'))
    expect(r.agora().toISOString()).toBe('2026-09-06T12:00:00.000Z')
  })

  it('avançar move o tempo', async () => {
    const r = relogioDeTeste(new Date('2026-09-06T12:00:00Z'))
    await r.avancar(5000)
    expect(r.agora().toISOString()).toBe('2026-09-06T12:00:05.000Z')
  })

  it('esperar só resolve quando o tempo avança', async () => {
    const r = relogioDeTeste(new Date('2026-09-06T12:00:00Z'))
    let resolveu = false
    const p = r.esperar(1000).then(() => {
      resolveu = true
    })
    await Promise.resolve()
    expect(resolveu).toBe(false)
    await r.avancar(1000)
    await p
    expect(resolveu).toBe(true)
  })

  it('um avanço grande libera várias esperas', async () => {
    const r = relogioDeTeste(new Date('2026-09-06T12:00:00Z'))
    const ordem: number[] = []
    const a = r.esperar(1000).then(() => ordem.push(1))
    const b = r.esperar(2000).then(() => ordem.push(2))
    await r.avancar(3000)
    await Promise.all([a, b])
    expect(ordem).toEqual([1, 2])
  })

  it('esperar zero resolve no avanço seguinte', async () => {
    const r = relogioDeTeste(new Date('2026-09-06T12:00:00Z'))
    let ok = false
    const p = r.esperar(0).then(() => {
      ok = true
    })
    await r.avancar(0)
    await p
    expect(ok).toBe(true)
  })
})
