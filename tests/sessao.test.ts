import { describe, expect, it } from 'vitest'
import { extrairLsd } from '../src/content/sessao'

describe('extrairLsd', () => {
  it('acha o token na forma corrente, minificada', () => {
    const html = `["LSD",[],{"token":"AdSDYILJ7_i9b2I1qLsLqVgbYR4"},323]`
    expect(extrairLsd(html)).toBe('AdSDYILJ7_i9b2I1qLsLqVgbYR4')
  })

  it('tolera espaços, porque a minificação é escolha deles e não contrato', () => {
    const html = `[ "LSD" , [] , { "token" : "AdFolgado" } ]`
    expect(extrairLsd(html)).toBe('AdFolgado')
  })

  it('cai para o campo escondido do formulário', () => {
    const html = `<input type="hidden" name="lsd" value="AdForm456" autocomplete="off">`
    expect(extrairLsd(html)).toBe('AdForm456')
  })

  it('devolve null quando não há token, que é estado possível e não erro', () => {
    expect(extrairLsd('<html><body>nada aqui</body></html>')).toBeNull()
  })

  it('não confunde o token do DTSG com o do LSD', () => {
    const html = `["DTSGInitData",[],{"token":"NAcMnaoEhEste"},1]`
    expect(extrairLsd(html)).toBeNull()
  })
})
