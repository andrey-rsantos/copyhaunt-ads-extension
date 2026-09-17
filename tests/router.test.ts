import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { classificar } from '../src/core/router'

const PASTA = resolve(import.meta.dirname, 'fixtures')

describe('classificar', () => {
  it('reconhece resultado de busca pelo conteúdo', () => {
    expect(
      classificar({
        url: 'https://www.facebook.com/api/graphql/',
        corpo: '{"data":{"search_results_connection":{"edges":[]}}}',
      }),
    ).toBe('busca')
  })

  it('reconhece grupo de colação pelo conteúdo', () => {
    expect(
      classificar({
        url: 'https://www.facebook.com/api/graphql/',
        corpo: '{"data":{"collation_results":{"edges":[]}}}',
      }),
    ).toBe('colacao')
  })

  it('reconhece erro do GraphQL', () => {
    expect(
      classificar({
        url: 'https://www.facebook.com/api/graphql/',
        corpo: '{"errors":[{"message":"algo quebrou"}]}',
      }),
    ).toBe('erro')
  })

  it('ignora resposta que não é de anúncios', () => {
    expect(
      classificar({
        url: 'https://www.facebook.com/ajax/qm/',
        corpo: '{"payload":{}}',
      }),
    ).toBe('ignorar')
  })

  it('ignora corpo que não é JSON válido', () => {
    expect(
      classificar({
        url: 'https://www.facebook.com/api/graphql/',
        corpo: 'for (;;);{isso nao e json',
      }),
    ).toBe('ignorar')
  })

  it('classifica busca mesmo sem doc_id conhecido', () => {
    // O spec registra que a Meta troca os doc_id sem aviso. Reconhecer pelo
    // conteúdo é o que mantém a extensão viva quando isso acontece.
    expect(
      classificar({
        url: 'https://www.facebook.com/api/graphql/?doc_id=00000000000',
        corpo: '{"data":{"search_results_connection":{"edges":[]}}}',
      }),
    ).toBe('busca')
  })

  it('reconhece busca quando o marcador está no segundo objeto deferred', () => {
    const corpo = [
      '{"data":{"page":null},"extensions":{"is_final":false}}',
      '{"label":"resultados","data":{"ad_library_main":{"search_results_connection":{"edges":[]}}}}',
    ].join('\n')

    expect(
      classificar({
        url: 'https://www.facebook.com/api/graphql/',
        corpo,
      }),
    ).toBe('busca')
  })
})

describe('classificar contra as fixtures reais', () => {
  const arquivos = readdirSync(PASTA).filter(
    (f) => f.startsWith('payload-') && f.endsWith('.json'),
  )

  it('existe pelo menos uma fixture gravada', () => {
    expect(arquivos.length).toBeGreaterThan(0)
  })

  it('pelo menos uma fixture real é reconhecida como busca', () => {
    // Este é o invariante que importa: se o formato da Meta mudar a ponto de
    // nenhuma resposta de busca ser reconhecida, a extensão fica cega.
    //
    // Não se exige que TODA fixture seja classificada: o gravador salva
    // qualquer payload com marcador de anúncio, e nem todo payload da Meta
    // é um dos quatro tipos que nos interessam.
    const tipos = arquivos.map((arquivo) => ({
      arquivo,
      tipo: classificar({
        url: 'https://www.facebook.com/api/graphql/',
        corpo: readFileSync(join(PASTA, arquivo), 'utf8'),
      }),
    }))

    // Diagnóstico: sai no terminal quando o teste falha, e ajuda a entender
    // o que a Meta está mandando hoje.
    console.log(
      'classificação das fixtures:',
      tipos.map((t) => `${t.arquivo}=${t.tipo}`).join(' '),
    )

    expect(tipos.some((t) => t.tipo === 'busca')).toBe(true)
  })
})
