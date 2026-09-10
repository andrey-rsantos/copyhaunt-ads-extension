// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ID_ENXERTOS,
  plantarEnxertos,
  type Enxerto,
  type Plantio,
} from '../../src/content/enxertos'
import {
  CSS_ENXERTOS,
  CSS_GAVETA,
  CSS_PROGRESSO,
} from '../../src/content/estilo'

let plantio: Plantio | null = null

afterEach(() => {
  plantio?.parar()
  plantio = null
  document.body.innerHTML = ''
})

function montarBarra(): void {
  document.body.innerHTML = `
    <div id="barra" style="display:flex;flex-direction:row">
      <div><div role="combobox">Brazil</div></div>
      <div id="envelope-busca"><input type="search"></div>
    </div>
  `
}

function doisEnxertos(aoClicar = () => {}): Enxerto[] {
  return [
    {
      chave: 'calendario',
      glifo: '📅',
      titulo: '7+ dias no ar',
      variante: 'contorno',
      aoClicar,
    },
    {
      chave: 'minerar',
      glifo: 'Minerar',
      titulo: 'Minerar',
      variante: 'solido',
      aoClicar,
    },
  ]
}

describe('plantarEnxertos', () => {
  it('planta o host dentro da fila da busca', () => {
    montarBarra()
    plantio = plantarEnxertos(document, doisEnxertos())

    const host = document.getElementById(ID_ENXERTOS)
    expect(host).not.toBeNull()
    expect(host?.parentElement?.id).toBe('barra')
  })

  it('planta os botões pedidos dentro do shadow root', () => {
    montarBarra()
    plantio = plantarEnxertos(document, doisEnxertos())

    const shadow = document.getElementById(ID_ENXERTOS)?.shadowRoot
    const botoes = shadow?.querySelectorAll('[data-chave]')
    expect(botoes?.length).toBe(2)
    expect(shadow?.querySelector('[data-chave="minerar"]')).not.toBeNull()
  })

  it('não duplica quando chamado duas vezes', () => {
    montarBarra()
    plantio = plantarEnxertos(document, doisEnxertos())
    const segundo = plantarEnxertos(document, doisEnxertos())

    expect(document.querySelectorAll(`#${ID_ENXERTOS}`).length).toBe(1)
    segundo.parar()
  })

  it('chama aoClicar com o botão clicado', () => {
    montarBarra()
    const espiao = vi.fn()
    plantio = plantarEnxertos(document, doisEnxertos(espiao))

    const shadow = document.getElementById(ID_ENXERTOS)?.shadowRoot
    const botao = shadow?.querySelector<HTMLElement>('[data-chave="minerar"]')
    botao?.click()

    expect(espiao).toHaveBeenCalledTimes(1)
    expect(espiao.mock.calls[0][0]).toBe(botao)
  })

  it('degrada em silêncio quando não há âncora', () => {
    document.body.innerHTML = '<div>sem busca, sem combobox</div>'
    expect(() => {
      plantio = plantarEnxertos(document, doisEnxertos())
    }).not.toThrow()
    expect(document.getElementById(ID_ENXERTOS)).toBeNull()
  })

  it('replanta quando a Meta remove o host', async () => {
    montarBarra()
    plantio = plantarEnxertos(document, doisEnxertos())

    document.getElementById(ID_ENXERTOS)?.remove()
    expect(document.getElementById(ID_ENXERTOS)).toBeNull()

    await vi.waitFor(() => {
      expect(document.getElementById(ID_ENXERTOS)).not.toBeNull()
    })
  })

  it('replanta quando a Meta troca a barra inteira', async () => {
    montarBarra()
    plantio = plantarEnxertos(document, doisEnxertos())

    // É o que acontece numa busca nova: nó do input trocado, barra refeita.
    montarBarra()

    await vi.waitFor(() => {
      const host = document.getElementById(ID_ENXERTOS)
      expect(host).not.toBeNull()
      expect(host?.parentElement?.id).toBe('barra')
    })
  })

  it('parar desliga o replantio', async () => {
    montarBarra()
    plantio = plantarEnxertos(document, doisEnxertos())
    plantio.parar()
    plantio = null

    document.getElementById(ID_ENXERTOS)?.remove()

    // Sem esperar por tempo: forçar uma mutação e conferir que segue ausente.
    document.body.appendChild(document.createElement('div'))
    await Promise.resolve()
    expect(document.getElementById(ID_ENXERTOS)).toBeNull()
  })
})

/**
 * A folha é compartilhada com as bandejas dos cards, cujo host é um div sem
 * estilo próprio que conta com o `all: initial` de CSS_BANDEJA para não
 * ocupar espaço. Um `:host` solto aqui venceria aquele por vir depois, daria
 * `display: flex` ao host da bandeja e empurraria o conteúdo de todo card
 * para baixo. jsdom não faz layout, então só um teste do texto pega isto.
 */
describe('CSS_ENXERTOS', () => {
  it('não define :host sem escopo, que vazaria para as bandejas', () => {
    expect(CSS_ENXERTOS).not.toMatch(/^\s*:host\s*\{/m)
  })

  it('escopa o :host ao host dos enxertos', () => {
    expect(CSS_ENXERTOS).toContain(':host(#copyhaunt-enxertos)')
  })
})

/**
 * A folha é compartilhada com as bandejas dos cards, e as duas usam a classe
 * `.botao`. Sem escopo, a regra que vier depois vence dentro do shadow da
 * outra: os botões de 30x30 da bandeja virariam inline-flex de 36 px com
 * padding lateral. jsdom não faz layout, então só um teste do texto pega isto.
 */
describe('escopo das folhas dos enxertos', () => {
  const seletoresSoltos = (css: string): string[] =>
    css
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('.') && l.includes('{'))

  it('CSS_ENXERTOS não tem seletor de classe sem escopo', () => {
    expect(seletoresSoltos(CSS_ENXERTOS)).toEqual([])
  })

  it('CSS_GAVETA não tem seletor de classe sem escopo', () => {
    expect(seletoresSoltos(CSS_GAVETA)).toEqual([])
  })

  it('CSS_PROGRESSO não tem seletor de classe sem escopo', () => {
    expect(seletoresSoltos(CSS_PROGRESSO)).toEqual([])
  })
})
