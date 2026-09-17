// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { criarShadow, CSS_BANDEJA } from '../src/content/estilo'

const IDV = readFileSync(
  resolve(import.meta.dirname, '..', 'CopyHaunt-IDV.md'),
  'utf8',
)

describe('CSS_BANDEJA', () => {
  it.each(['#7C3AED', '#A855F7', '#C4A7FF'])(
    'usa a cor %s, que consta no IDV',
    (cor) => {
      expect(CSS_BANDEJA).toContain(cor)
      expect(IDV).toContain(cor)
    },
  )

  it('não inventa cor fora do IDV', () => {
    const usadas = CSS_BANDEJA.match(/#[0-9A-Fa-f]{6}/g) ?? []
    for (const cor of new Set(usadas)) {
      // Branco é permitido: o IDV o define como texto principal.
      if (cor.toUpperCase() === '#FFFFFF') continue
      expect(IDV, `${cor} não está no IDV`).toContain(cor.toUpperCase())
    }
  })

  it('não usa border no card, que deslocaria a grade', () => {
    expect(CSS_BANDEJA).not.toMatch(/\bborder\s*:/)
  })
})

describe('criarShadow', () => {
  it('cria um shadow root aberto no host', () => {
    const host = document.createElement('div')
    const shadow = criarShadow(host)
    expect(shadow).toBeTruthy()
    expect(host.shadowRoot).toBe(shadow)
  })

  it('devolve o mesmo shadow se já existir', () => {
    const host = document.createElement('div')
    const a = criarShadow(host)
    const b = criarShadow(host)
    expect(b).toBe(a)
  })

  it('o estilo fica dentro do shadow, não vaza para o documento', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    criarShadow(host)
    // Nenhum <style> nosso no documento principal.
    expect(document.head.querySelector('style[data-copyhaunt]')).toBeNull()
  })
})

/**
 * Cada host recebe só a sua folha. A folha compartilhada entre bandejas e
 * enxertos colidiu três vezes pela classe `.botao` — a última deu aos
 * enxertos o `width: 30px` da bandeja, e "Tempo ativo" não cabe em 30 px.
 * jsdom não faz layout, então o teste lê o texto do <style> de fallback.
 */
describe('criarShadow separa as folhas', () => {
  const css = (host: HTMLElement): string =>
    criarShadow(host).querySelector('style')?.textContent ?? ''

  it('o shadow dos enxertos não recebe as regras da bandeja', () => {
    const host = document.createElement('div')
    host.id = 'copyhaunt-enxertos'
    expect(css(host)).not.toContain('width: 30px')
    expect(css(host)).toContain(':host(#copyhaunt-enxertos)')
  })

  it('o shadow da bandeja não recebe as regras dos enxertos', () => {
    const host = document.createElement('div')
    expect(css(host)).toContain('width: 30px')
    expect(css(host)).not.toContain(':host(#copyhaunt-enxertos)')
  })
})
