// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  acharBarraDeFiltros,
  acharLinhaDaBusca,
  formaDaBarra,
} from '../../src/content/barra'

/** A forma de uma linha, medida em 1282 px: [país] [categoria] [busca]. */
function montarFormaLinha(): void {
  document.body.innerHTML = `
    <div id="ruido"><input type="radio"></div>
    <div id="barra" style="display:flex;flex-direction:row">
      <div id="pais"><div role="combobox">Brazil</div></div>
      <div id="categoria"><div role="combobox">All ads</div></div>
      <div id="envelope-busca"><div><input type="search"></div></div>
    </div>
  `
}

/** A forma de duas linhas, medida em 1036 px. */
function montarFormaColuna(): void {
  document.body.innerHTML = `
    <div id="barra" style="display:flex;flex-direction:column">
      <div id="linha-filtros" style="display:flex;flex-direction:row">
        <div><div role="combobox">Brazil</div></div>
        <div><div role="combobox">All ads</div></div>
      </div>
      <div id="linha-busca" style="display:flex;flex-direction:row">
        <div id="envelope-busca"><div><input type="search"></div></div>
      </div>
    </div>
  `
}

describe('acharBarraDeFiltros', () => {
  it('acha o ancestral mais próximo da busca que também tem combobox', () => {
    montarFormaLinha()
    expect(acharBarraDeFiltros(document)?.id).toBe('barra')
  })

  it('acha a barra também na forma de duas linhas', () => {
    montarFormaColuna()
    expect(acharBarraDeFiltros(document)?.id).toBe('barra')
  })

  it('devolve null sem busca na página, em vez de lançar', () => {
    document.body.innerHTML = '<div><div role="combobox">só isso</div></div>'
    expect(acharBarraDeFiltros(document)).toBeNull()
  })

  it('devolve null quando há busca mas nenhum combobox', () => {
    document.body.innerHTML = '<div><input type="search"></div>'
    expect(acharBarraDeFiltros(document)).toBeNull()
  })
})

describe('formaDaBarra', () => {
  it('reconhece a forma de uma linha', () => {
    montarFormaLinha()
    expect(formaDaBarra(document)).toBe('linha')
  })

  it('reconhece a forma de duas linhas', () => {
    montarFormaColuna()
    expect(formaDaBarra(document)).toBe('coluna')
  })

  it('devolve null quando não há barra', () => {
    document.body.innerHTML = ''
    expect(formaDaBarra(document)).toBeNull()
  })
})

describe('acharLinhaDaBusca', () => {
  it('na forma de uma linha, é a própria barra', () => {
    montarFormaLinha()
    expect(acharLinhaDaBusca(document)?.id).toBe('barra')
  })

  it('na forma de duas linhas, é a linha de baixo e não a barra', () => {
    montarFormaColuna()
    expect(acharLinhaDaBusca(document)?.id).toBe('linha-busca')
  })

  it('devolve null quando não há busca', () => {
    document.body.innerHTML = '<div role="combobox">nada</div>'
    expect(acharLinhaDaBusca(document)).toBeNull()
  })

  /**
   * Regressão medida contra a Meta real em 2026-09-10: a busca fica dentro de
   * wrappers que também são flex-row, com 20 px de altura. Uma regra que suba
   * procurando o primeiro flex-row cai num deles, e os botões vão parar dentro
   * da caixa de busca.
   */
  it('ignora os wrappers flex-row internos do campo de busca', () => {
    document.body.innerHTML = `
      <div id="barra" style="display:flex;flex-direction:row">
        <div><div role="combobox">Brazil</div></div>
        <div id="envelope-busca">
          <div id="wrapper-interno" style="display:flex;flex-direction:row">
            <input type="search">
          </div>
        </div>
      </div>
    `
    expect(acharLinhaDaBusca(document)?.id).toBe('barra')
  })
})
