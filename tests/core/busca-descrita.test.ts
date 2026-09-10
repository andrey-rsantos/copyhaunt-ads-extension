import { describe, expect, it } from 'vitest'
import { descreverBusca } from '../../src/core/busca-descrita'

const agora = new Date('2026-09-10T12:00:00Z')
const BASE = 'https://www.facebook.com/ads/library/'

describe('descreverBusca', () => {
  it('declara o termo, o país e o status', () => {
    const d = descreverBusca(
      `${BASE}?q=emagrecimento&country=BR&active_status=active`,
      agora,
    )
    expect(d).toContain('emagrecimento')
    expect(d).toContain('Brasil')
    expect(d).toContain('Ativos')
  })

  it('traduz o formato quando a Meta o carrega', () => {
    const d = descreverBusca(`${BASE}?q=x&country=BR&media_type=video`, agora)
    expect(d).toContain('Vídeo')
  })

  it('não inventa formato quando é "all"', () => {
    const d = descreverBusca(`${BASE}?q=x&country=BR&media_type=all`, agora)
    expect(d).not.toContain('Vídeo')
    expect(d).not.toContain('Imagem')
  })

  it('inclui o tempo ativo que a URL carrega', () => {
    const d = descreverBusca(
      `${BASE}?q=x&country=BR&start_date[max]=2026-09-03`,
      agora,
    )
    expect(d).toContain('7+ dias no ar')
  })

  it('sem termo, diz que a busca está vazia em vez de mentir', () => {
    const d = descreverBusca(`${BASE}?country=BR`, agora)
    expect(d).toContain('busca vazia')
  })

  it('país desconhecido aparece pelo código, sem quebrar', () => {
    const d = descreverBusca(`${BASE}?q=x&country=ZZ`, agora)
    expect(d).toContain('ZZ')
  })
})
