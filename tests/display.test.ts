import { describe, expect, it } from 'vitest'
import { diasAtivos, faixaBadge } from '../src/core/display'

describe('diasAtivos', () => {
  it('conta zero no mesmo dia', () => {
    expect(
      diasAtivos(new Date('2026-09-06T08:00:00Z'), new Date('2026-09-06T20:00:00Z')),
    ).toBe(0)
  })

  it('conta um dia', () => {
    expect(
      diasAtivos(new Date('2026-09-05T00:00:00Z'), new Date('2026-09-06T00:00:00Z')),
    ).toBe(1)
  })

  it('atravessa virada de mês', () => {
    expect(
      diasAtivos(new Date('2026-08-30T00:00:00Z'), new Date('2026-09-02T00:00:00Z')),
    ).toBe(3)
  })

  it('atravessa 29 de fevereiro em ano bissexto', () => {
    expect(
      diasAtivos(new Date('2024-02-28T00:00:00Z'), new Date('2024-03-01T00:00:00Z')),
    ).toBe(2)
  })

  it('nunca devolve negativo', () => {
    expect(
      diasAtivos(new Date('2026-09-10T00:00:00Z'), new Date('2026-09-06T00:00:00Z')),
    ).toBe(0)
  })
})

describe('faixaBadge', () => {
  it('menos de 7 dias é oferta nova', () => {
    expect(faixaBadge(0)).toBe('novo')
    expect(faixaBadge(6)).toBe('novo')
  })

  it('de 7 a 30 dias passou do teste', () => {
    expect(faixaBadge(7)).toBe('provado')
    expect(faixaBadge(30)).toBe('provado')
  })

  it('mais de 30 dias é validada', () => {
    expect(faixaBadge(31)).toBe('validado')
    expect(faixaBadge(141)).toBe('validado')
  })
})
