import { describe, expect, it } from 'vitest'
import { extrairTokenDeSessao } from '../src/content/sessao'

describe('extrairTokenDeSessao', () => {
  it('acha o token na forma DTSGInitialData', () => {
    const html = `<script>require("DTSGInitialData",[],{"token":"NAcMabc123"},258);</script>`
    expect(extrairTokenDeSessao(html)).toBe('NAcMabc123')
  })

  it('acha o token na forma DTSGInitData, com os campos extras', () => {
    const html = `["DTSGInitData",[],{"token":"NAcMxyz789","async_get_token":"outro"},123]`
    expect(extrairTokenDeSessao(html)).toBe('NAcMxyz789')
  })

  it('tolera espaços em volta dos dois-pontos e das vírgulas', () => {
    const html = `[ "DTSGInitData" , [] , { "token" : "NAcMfolgado" } ]`
    expect(extrairTokenDeSessao(html)).toBe('NAcMfolgado')
  })

  it('cai para o campo escondido do formulário quando não há o JSON', () => {
    const html = `<form><input type="hidden" name="token_de_sessao" value="NAcMform456"></form>`
    expect(extrairTokenDeSessao(html)).toBe('NAcMform456')
  })

  it('devolve nulo sem sessão, que é o caso medido de navegador deslogado', () => {
    // Medido em perfil descartável: sem login, o token simplesmente não está
    // no HTML. É por isso que o caminho 2 exige a sessão do usuário.
    expect(extrairTokenDeSessao('<html><body>nada aqui</body></html>')).toBeNull()
  })

  it('devolve nulo para HTML vazio', () => {
    expect(extrairTokenDeSessao('')).toBeNull()
  })

  it('não confunde o token do LSD com o dtsg', () => {
    expect(extrairTokenDeSessao(`["LSD",[],{"token":"AVqQnaoEhEste"},321]`)).toBeNull()
  })
})
