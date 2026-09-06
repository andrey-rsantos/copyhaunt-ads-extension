import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  resolve(import.meta.dirname, '../src/styles/tokens.css'),
  'utf8',
)

/** Extrai o valor de uma custom property do CSS. */
function token(nome: string): string | undefined {
  const match = css.match(new RegExp(`--${nome}:\\s*([^;]+);`))
  return match?.[1].trim()
}

describe('tokens da identidade visual', () => {
  it('importa o Tailwind', () => {
    expect(css).toContain('@import "tailwindcss"')
  })

  it('declara o bloco @theme', () => {
    expect(css).toContain('@theme')
  })

  it.each([
    ['color-ink', '#08070D'],
    ['color-charcoal', '#111019'],
    ['color-purple', '#7C3AED'],
    ['color-neon', '#A855F7'],
    ['color-lavender', '#C4A7FF'],
    ['color-deep', '#3B1D73'],
    ['color-muted', '#B8B5C6'],
  ])('define %s com o valor do CopyHaunt-IDV.md', (nome, valor) => {
    expect(token(nome)).toBe(valor)
  })

  it('usa Sora como tipografia de marca', () => {
    expect(token('font-display')).toContain('Sora')
  })

  it('usa Inter como tipografia de produto', () => {
    expect(token('font-sans')).toContain('Inter')
  })

  it('define o raio dos cards dentro da faixa do IDV', () => {
    const raio = Number.parseInt(token('radius-card') ?? '0', 10)
    expect(raio).toBeGreaterThanOrEqual(12)
    expect(raio).toBeLessThanOrEqual(16)
  })

  it('define o raio dos botões dentro da faixa do IDV', () => {
    const raio = Number.parseInt(token('radius-btn') ?? '0', 10)
    expect(raio).toBeGreaterThanOrEqual(8)
    expect(raio).toBeLessThanOrEqual(10)
  })
})
