// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  acharCards,
  definirPadraoAncora,
  PADRAO_LIBRARY_ID,
} from '../src/content/anchor'

function card(texto: string): Document {
  const doc = document.implementation.createHTMLDocument('teste')
  const div = document.createElement('div')
  const span = document.createElement('span')
  span.textContent = texto
  div.appendChild(span)
  doc.body.appendChild(div)
  return doc
}

afterEach(() => {
  // Estado de módulo: sem isto um teste contamina o seguinte.
  definirPadraoAncora(PADRAO_LIBRARY_ID.source)
})

describe('definirPadraoAncora', () => {
  it('faz a ancoragem passar a usar o padrão novo', () => {
    // Padrão de 18 dígitos: o de 16 deixa de ser reconhecido.
    definirPadraoAncora('(?<!\\d)(\\d{18})(?!\\d)')
    expect(acharCards(card('Library ID: 1223312153071533')).size).toBe(0)
    expect(acharCards(card('Library ID: 122331215307153312')).size).toBe(1)
  })

  it('volta a ancorar normalmente com o padrão de fábrica', () => {
    definirPadraoAncora(PADRAO_LIBRARY_ID.source)
    expect(acharCards(card('Library ID: 1223312153071533')).size).toBe(1)
  })

  it('ignora padrão que não compila, mantendo o que funcionava', () => {
    definirPadraoAncora('(?<!\\d')
    expect(acharCards(card('Library ID: 1223312153071533')).size).toBe(1)
  })
})
