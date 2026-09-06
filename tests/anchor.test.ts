// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  acharCards,
  acharGrade,
  extrairLibraryId,
  PADRAO_LIBRARY_ID,
} from '../src/content/anchor'

/** Monta uma grade parecida com a da Meta: id enterrado fundo no card. */
function montarGrade(ids: string[], rotulo = 'Library ID: '): HTMLElement {
  const grade = document.createElement('div')
  for (const id of ids) {
    const card = document.createElement('div')
    let atual = card
    // Oito níveis, como medido no DOM real.
    for (let i = 0; i < 7; i += 1) {
      const filho = document.createElement('div')
      atual.appendChild(filho)
      atual = filho
    }
    const span = document.createElement('span')
    span.textContent = `${rotulo}${id}`
    atual.appendChild(span)
    // Um irmão com texto, para o card não ser só o id.
    const extra = document.createElement('div')
    extra.textContent = 'Started running on Apr 17, 2026'
    card.appendChild(extra)
    grade.appendChild(card)
  }
  document.body.appendChild(grade)
  return grade
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('extrairLibraryId', () => {
  it('extrai o id de um texto com rótulo', () => {
    expect(extrairLibraryId('Library ID: 2366492917183805')).toBe(
      '2366492917183805',
    )
  })

  it('funciona em português', () => {
    expect(
      extrairLibraryId('Identificação da biblioteca: 2366492917183805'),
    ).toBe('2366492917183805')
  })

  it('acha o id mesmo colado na palavra seguinte', () => {
    // textContent concatena sem espaço: um \b no fim da regex falharia aqui.
    expect(extrairLibraryId('ID: 2366492917183805Started running')).toBe(
      '2366492917183805',
    )
  })

  it('ignora número curto demais', () => {
    expect(extrairLibraryId('total 12345')).toBeNull()
  })

  it('ignora número longo demais', () => {
    expect(extrairLibraryId('x 123456789012345678901')).toBeNull()
  })

  it('devolve null quando não há id', () => {
    expect(extrairLibraryId('Started running on Apr 17')).toBeNull()
  })
})

describe('PADRAO_LIBRARY_ID', () => {
  it('não usa \\b no fim, que quebraria com texto colado', () => {
    expect(PADRAO_LIBRARY_ID.source).not.toContain('\\b')
  })
})

describe('acharCards', () => {
  it('acha um card por id', () => {
    montarGrade(['111111111111111', '222222222222222'])
    const cards = acharCards(document.body)
    expect(cards.size).toBe(2)
    expect(cards.has('111111111111111')).toBe(true)
    expect(cards.has('222222222222222')).toBe(true)
  })

  it('o elemento devolvido contém exatamente um id', () => {
    montarGrade(['111111111111111', '222222222222222'])
    const card = acharCards(document.body).get('111111111111111')
    const achados = (card?.textContent ?? '').match(
      new RegExp(PADRAO_LIBRARY_ID.source, 'g'),
    )
    expect(achados).toHaveLength(1)
  })

  it('o card não é a folha: contém também o resto do texto', () => {
    montarGrade(['111111111111111'])
    const card = acharCards(document.body).get('111111111111111')
    expect(card?.textContent).toContain('Started running')
  })

  it('funciona com rótulo em português', () => {
    montarGrade(['333333333333333'], 'Identificação da biblioteca: ')
    expect(acharCards(document.body).size).toBe(1)
  })

  it('devolve vazio quando não há card', () => {
    document.body.innerHTML = '<div>nada aqui</div>'
    expect(acharCards(document.body).size).toBe(0)
  })

  it('não devolve o mesmo elemento para ids diferentes', () => {
    montarGrade(['111111111111111', '222222222222222'])
    const cards = acharCards(document.body)
    const a = cards.get('111111111111111')
    const b = cards.get('222222222222222')
    expect(a).not.toBe(b)
  })
})

describe('acharGrade', () => {
  it('devolve o ancestral comum dos cards', () => {
    const grade = montarGrade(['111111111111111', '222222222222222'])
    expect(acharGrade(acharCards(document.body))).toBe(grade)
  })

  it('devolve null sem cards', () => {
    expect(acharGrade(new Map())).toBeNull()
  })
})
