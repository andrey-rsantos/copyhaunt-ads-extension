import { describe, expect, it } from 'vitest'
import { AdStore } from '../src/core/store'
import type { Ad } from '../src/core/types'

function ad(id: string, pageId = '9', colacao = 1, colacaoId?: string): Ad {
  return {
    id,
    iniciouEm: new Date('2026-08-01T00:00:00Z'),
    colacao,
    colacaoId,
    anunciante: { pageId, pageName: 'Anunciante ' + pageId },
    midias: [],
    plataformas: [],
    ativo: true,
  }
}

describe('AdStore', () => {
  it('guarda e devolve por id', () => {
    const s = new AdStore()
    s.adicionar([ad('1'), ad('2')])
    expect(s.obter('1')?.id).toBe('1')
    expect(s.total()).toBe(2)
  })

  it('não duplica o mesmo anúncio', () => {
    const s = new AdStore()
    s.adicionar([ad('1')])
    s.adicionar([ad('1')])
    expect(s.total()).toBe(1)
  })

  it('conta a presença do anunciante na sessão', () => {
    const s = new AdStore()
    s.adicionar([ad('1', 'p1'), ad('2', 'p1'), ad('3', 'p2')])
    expect(s.presenca('p1')).toBe(2)
    expect(s.presenca('p2')).toBe(1)
  })

  it('presença não cresce com anúncio repetido', () => {
    const s = new AdStore()
    s.adicionar([ad('1', 'p1')])
    s.adicionar([ad('1', 'p1')])
    expect(s.presenca('p1')).toBe(1)
  })

  it('presença de anunciante desconhecido é zero', () => {
    expect(new AdStore().presenca('nunca-visto')).toBe(0)
  })

  it('limpar zera tudo', () => {
    const s = new AdStore()
    s.adicionar([ad('1', 'p1')])
    s.limpar()
    expect(s.total()).toBe(0)
    expect(s.presenca('p1')).toBe(0)
  })

  it('todos devolve na ordem de inserção', () => {
    const s = new AdStore()
    s.adicionar([ad('1'), ad('2'), ad('3')])
    expect(s.todos().map((a) => a.id)).toEqual(['1', '2', '3'])
  })
})

describe('colacaoDe', () => {
  function ad(id: string, colacao: number, colacaoId?: string): Ad {
    return {
      id,
      iniciouEm: new Date('2026-08-01T12:00:00Z'),
      colacao,
      colacaoId,
      anunciante: { pageId: 'p1', pageName: 'A' },
      midias: [],
      plataformas: [],
      ativo: true,
    }
  }

  it('usa o número da Meta quando ele veio', () => {
    const store = new AdStore()
    store.adicionar([ad('1', 7, 'g1')])
    expect(store.colacaoDe(store.obter('1')!)).toBe(7)
  })

  it('conta os membros do grupo quando o número não veio', () => {
    const store = new AdStore()
    store.adicionar([ad('1', 1, 'g1'), ad('2', 1, 'g1'), ad('3', 1, 'g1')])
    expect(store.colacaoDe(store.obter('2')!)).toBe(3)
  })

  it('fica com o maior entre o número da Meta e os membros vistos', () => {
    const store = new AdStore()
    store.adicionar([ad('1', 7, 'g1'), ad('2', 1, 'g1')])
    expect(store.colacaoDe(store.obter('2')!)).toBe(7)
  })

  it('sem grupo, devolve a colação do próprio anúncio', () => {
    const store = new AdStore()
    store.adicionar([ad('1', 1)])
    expect(store.colacaoDe(store.obter('1')!)).toBe(1)
  })
})
