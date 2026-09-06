import { describe, expect, it } from 'vitest'
import {
  CONFIG_EMBUTIDA,
  validarConfig,
  type ConfigRemota,
} from '../src/core/config'

const VALIDA: ConfigRemota = {
  version: 7,
  anchors: { libraryIdPattern: '(?<!\\d)(\\d{15,17})(?!\\d)' },
}

describe('CONFIG_EMBUTIDA', () => {
  it('é ela própria válida, senão a queda não teria para onde cair', () => {
    expect(validarConfig(CONFIG_EMBUTIDA)).toEqual(CONFIG_EMBUTIDA)
  })

  it('traz o padrão de ancoragem que o código usa hoje', () => {
    const re = new RegExp(CONFIG_EMBUTIDA.anchors.libraryIdPattern)
    expect('Library ID: 2366492917183805').toMatch(re)
  })
})

describe('validarConfig', () => {
  it('aceita uma config bem formada', () => {
    expect(validarConfig(VALIDA)).toEqual(VALIDA)
  })

  it('devolve só os campos conhecidos, descartando o resto', () => {
    const comLixo = { ...VALIDA, extra: 'ignorado', scripts: ['perigoso'] }
    expect(validarConfig(comLixo)).toEqual(VALIDA)
  })

  it.each([
    ['nulo', null],
    ['string', 'nada disso'],
    ['sem version', { anchors: VALIDA.anchors }],
    ['version não numérica', { version: 'sete', anchors: VALIDA.anchors }],
    ['sem anchors', { version: 7 }],
    ['anchors nulo', { version: 7, anchors: null }],
    ['padrão vazio', { version: 7, anchors: { libraryIdPattern: '' } }],
    [
      'padrão não string',
      { version: 7, anchors: { libraryIdPattern: 123 } },
    ],
  ])('recusa config %s', (_caso, bruto) => {
    expect(validarConfig(bruto)).toBeNull()
  })

  it('recusa padrão que não compila como regex', () => {
    const quebrado = { version: 7, anchors: { libraryIdPattern: '(?<!\\d' } }
    expect(validarConfig(quebrado)).toBeNull()
  })

  it('recusa padrão longo demais, que poderia travar a aba', () => {
    const gigante = { version: 7, anchors: { libraryIdPattern: 'a'.repeat(501) } }
    expect(validarConfig(gigante)).toBeNull()
  })
})

describe('advertiserDocId', () => {
  const COM_DOC = {
    ...VALIDA,
    advertiserDocId: '7193625857423421',
  }

  it('aceita e devolve o doc_id quando ele vem', () => {
    expect(validarConfig(COM_DOC)).toEqual(COM_DOC)
  })

  it('config sem doc_id continua válida, apenas sem ele', () => {
    // É assim que se desliga a consulta forjada em minutos: apagando o campo
    // do JSON hospedado, sem passar pela revisão da Chrome Web Store.
    expect(validarConfig(VALIDA)).toEqual(VALIDA)
    expect(validarConfig(VALIDA)).not.toHaveProperty('advertiserDocId')
  })

  it.each([
    ['não string', 7193625857423421],
    ['vazio', ''],
    ['com letras', '71936a25857423421'],
    ['com espaço', '7193625857 423421'],
  ])('descarta doc_id %s, mantendo o resto da config', (_caso, docId) => {
    expect(validarConfig({ ...VALIDA, advertiserDocId: docId })).toEqual(VALIDA)
  })
})
