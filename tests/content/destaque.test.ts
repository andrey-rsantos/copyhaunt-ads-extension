// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { destacarCriativoRepetido } from '../../src/content/destaque'

function card(texto: string): HTMLElement {
  const card = document.createElement('article')
  const linha = document.createElement('div')
  linha.textContent = texto
  card.appendChild(linha)
  return card
}

describe('destacarCriativoRepetido', () => {
  it('destaca a mensagem quando o criativo aparece em dois anúncios ou mais', () => {
    const c = card('2 anúncios usam esse criativo e esse texto')

    destacarCriativoRepetido(c)

    const linha = c.firstElementChild as HTMLElement
    expect(linha.dataset.copyhauntColacao).toBe('destacado')
    expect(linha.style.color).toBe('rgb(124, 58, 237)')
    expect(linha.style.fontWeight).toBe('600')
  })

  it('não destaca a mensagem de um único anúncio', () => {
    const c = card('1 anúncio usa esse criativo e esse texto')

    destacarCriativoRepetido(c)

    expect(c.firstElementChild?.getAttribute('data-copyhaunt-colacao')).toBeNull()
  })
})
