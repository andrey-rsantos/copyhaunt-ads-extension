import { describe, expect, it } from 'vitest'
import { extrairObjetosJson } from '../src/core/json-stream'

describe('extrairObjetosJson', () => {
  it('lê um JSON único', () => {
    expect(extrairObjetosJson('{"data":{"ok":true}}')).toEqual([
      { data: { ok: true } },
    ])
  })

  it('remove o prefixo anti-sequestro de um JSON único', () => {
    expect(extrairObjetosJson('for (;;);{"data":{"ok":true}}')).toEqual([
      { data: { ok: true } },
    ])
  })

  it('lê objetos JSON deferred separados por quebra de linha', () => {
    const corpo = [
      '{"data":{"page":null},"extensions":{"is_final":false}}',
      '{"label":"resultados","data":{"ad_library_main":{"search_results_connection":{"edges":[]}}}}',
    ].join('\n')

    expect(extrairObjetosJson(corpo)).toHaveLength(2)
  })

  it('ignora linhas inválidas sem perder linhas válidas', () => {
    const corpo = '{"data":{"primeiro":true}}\nisto não é JSON\n{"data":{"segundo":true}}'

    expect(extrairObjetosJson(corpo)).toEqual([
      { data: { primeiro: true } },
      { data: { segundo: true } },
    ])
  })

  it('retorna lista vazia para corpo inválido', () => {
    expect(extrairObjetosJson('isto não é JSON')).toEqual([])
  })
})
