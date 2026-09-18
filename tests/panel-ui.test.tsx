// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../src/panel/App'

let raiz: Root | null = null
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  act(() => raiz?.unmount())
  raiz = null
  document.body.innerHTML = ''
})

describe('painel de filtros', () => {
  it('destaca o preset ativo com a variante selecionada', () => {
    document.body.innerHTML = '<div id="root"></div>'
    raiz = createRoot(document.querySelector('#root')!)
    act(() => raiz?.render(<App />))

    const preset = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (botao) => botao.textContent === '14+ Dias',
    )!
    act(() => preset.click())

    expect(preset.getAttribute('aria-pressed')).toBe('true')
    expect(preset.className).toContain('botao--selecionado')
  })
})
