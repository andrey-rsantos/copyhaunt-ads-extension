// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { pintarGrade } from '../src/content/overlay'
import { ATRIBUTO_ID } from '../src/content/tray'
import { CRITERIOS_PADRAO, type Criterios } from '../src/core/criteria'
import { AdStore } from '../src/core/store'
import type { Ad } from '../src/core/types'

const AGORA = new Date('2026-09-06T12:00:00Z')
const SO_COLACAO: Criterios = {
  ...CRITERIOS_PADRAO,
  diasMin: null,
  diasMax: null,
  presencaMinima: null,
}

function ad(id: string, colacao: number): Ad {
  return {
    id,
    iniciouEm: new Date('2026-08-01T12:00:00Z'),
    colacao,
    anunciante: { pageId: 'p', pageName: 'A' },
    midias: [],
    plataformas: [],
    ativo: true,
  }
}

function montarGrade(ids: string[]): void {
  const grade = document.createElement('div')
  for (const id of ids) {
    const card = document.createElement('div')
    const span = document.createElement('span')
    span.textContent = `Library ID: ${id}`
    card.appendChild(span)
    const extra = document.createElement('div')
    extra.textContent = 'Started running'
    card.appendChild(extra)
    grade.appendChild(card)
  }
  document.body.appendChild(grade)
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('pintarGrade', () => {
  it('planta bandeja só nos cards cujo anúncio está no índice', () => {
    montarGrade(['111111111111111', '222222222222222'])
    const store = new AdStore()
    store.adicionar([ad('111111111111111', 9)])

    const r = pintarGrade(document.body, store, SO_COLACAO, AGORA, false)
    expect(r.plantados).toBe(1)
    expect(document.querySelectorAll(`[${ATRIBUTO_ID}]`)).toHaveLength(1)
  })

  it('aprova e reprova conforme os critérios', () => {
    montarGrade(['111111111111111', '222222222222222'])
    const store = new AdStore()
    store.adicionar([ad('111111111111111', 9), ad('222222222222222', 1)])

    const r = pintarGrade(document.body, store, SO_COLACAO, AGORA, false)
    expect(r.aprovados).toBe(1)
  })

  it('esconde os reprovados quando pedido', () => {
    montarGrade(['111111111111111', '222222222222222'])
    const store = new AdStore()
    store.adicionar([ad('111111111111111', 9), ad('222222222222222', 1)])

    const r = pintarGrade(document.body, store, SO_COLACAO, AGORA, true)
    expect(r.escondidos).toBe(1)
  })

  it('não esconde nada quando não pedido', () => {
    montarGrade(['222222222222222'])
    const store = new AdStore()
    store.adicionar([ad('222222222222222', 1)])

    const r = pintarGrade(document.body, store, SO_COLACAO, AGORA, false)
    expect(r.escondidos).toBe(0)
  })

  it('pintar duas vezes não duplica bandejas', () => {
    montarGrade(['111111111111111'])
    const store = new AdStore()
    store.adicionar([ad('111111111111111', 9)])

    pintarGrade(document.body, store, SO_COLACAO, AGORA, false)
    pintarGrade(document.body, store, SO_COLACAO, AGORA, false)
    expect(document.querySelectorAll(`[${ATRIBUTO_ID}]`)).toHaveLength(1)
  })

  it('grade vazia devolve tudo zerado', () => {
    const r = pintarGrade(document.body, new AdStore(), SO_COLACAO, AGORA, true)
    expect(r).toEqual({ plantados: 0, aprovados: 0, escondidos: 0 })
  })
})
