import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CONFIG_EMBUTIDA,
  validarConfig,
  type ConfigRemota,
} from '../src/core/config'

/** O arquivo destinado à hospedagem, lido do disco: a outra metade do par. */
const HOSPEDADA = JSON.parse(
  readFileSync(new URL('../config/config.json', import.meta.url), 'utf8'),
) as ConfigRemota

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

  /**
   * Sem o doc_id aqui, a queda desliga o Instagram sem ninguém ter decidido
   * isso: a config hospedada 404 e a extensão conclui, calada, que o recurso
   * está desligado. Foi o que aconteceu, e custou uma sessão de teste manual.
   *
   * Comparar com o arquivo hospedado, em vez de fixar o número, mantém as
   * duas cópias no mesmo valor. Desligar o recurso de verdade é apagar o campo
   * dos dois lados — e este teste é quem cobra o segundo lado.
   */
  it('traz o mesmo doc_id do arquivo hospedado', () => {
    expect(CONFIG_EMBUTIDA.advertiserDocId).toBe(HOSPEDADA.advertiserDocId)
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

describe('bloco mining', () => {
  const base = { version: 1, anchors: { libraryIdPattern: '(\\d+)' } }

  it('a config embutida traz os valores medidos', () => {
    expect(CONFIG_EMBUTIDA.mining).toEqual({
      pisoMs: 2500,
      timeoutMs: 4500,
      jitter: 0.4,
    })
  })

  it('aceita um bloco mining bem formado', () => {
    const c = validarConfig({
      ...base,
      mining: { pisoMs: 3000, timeoutMs: 5000, jitter: 0.2 },
    })
    expect(c?.mining).toEqual({ pisoMs: 3000, timeoutMs: 5000, jitter: 0.2 })
  })

  it('config sem mining continua válida', () => {
    const c = validarConfig(base)
    expect(c).not.toBeNull()
    expect(c?.mining).toBeUndefined()
  })

  it('descarta o bloco quando um campo está fora da faixa', () => {
    expect(validarConfig({
      ...base,
      mining: { pisoMs: 500, timeoutMs: 5000, jitter: 0.2 },
    })?.mining).toBeUndefined()
    expect(validarConfig({
      ...base,
      mining: { pisoMs: 3000, timeoutMs: 40000, jitter: 0.2 },
    })?.mining).toBeUndefined()
    expect(validarConfig({
      ...base,
      mining: { pisoMs: 3000, timeoutMs: 5000, jitter: 2 },
    })?.mining).toBeUndefined()
  })

  it('descarta o bloco quando um campo não é número', () => {
    expect(validarConfig({
      ...base,
      mining: { pisoMs: '3000', timeoutMs: 5000, jitter: 0.2 },
    })?.mining).toBeUndefined()
  })

  it('descarta o bloco quando o timeout não passa do piso', () => {
    expect(validarConfig({
      ...base,
      mining: { pisoMs: 5000, timeoutMs: 3000, jitter: 0.2 },
    })?.mining).toBeUndefined()
  })
})
