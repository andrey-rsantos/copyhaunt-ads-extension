import { describe, expect, it, vi } from 'vitest'
import {
  obterConfig,
  VALIDADE_MS,
  type Dependencias,
} from '../src/background/config-remota'
import { CONFIG_EMBUTIDA } from '../src/core/config'

const REMOTA = {
  version: 7,
  anchors: { libraryIdPattern: '(?<!\\d)(\\d{16,18})(?!\\d)' },
}

function resposta(corpo: unknown, ok = true) {
  return { ok, json: async () => corpo } as unknown as Response
}

/** Dependências de mentira, com um cache em memória. */
function deps(extra: Partial<Dependencias> = {}): Dependencias {
  const memoria = new Map<string, unknown>()
  return {
    buscar: vi.fn(async () => resposta(REMOTA)),
    ler: vi.fn(async (chave: string) => memoria.get(chave)),
    gravar: vi.fn(async (chave: string, valor: unknown) => {
      memoria.set(chave, valor)
    }),
    agora: () => 1_000_000,
    ...extra,
  }
}

describe('obterConfig', () => {
  it('busca, valida e devolve a config remota', async () => {
    expect(await obterConfig(deps())).toEqual(REMOTA)
  })

  it('guarda o que buscou, para não buscar de novo na validade', async () => {
    const d = deps()
    await obterConfig(d)
    await obterConfig(d)
    expect(d.buscar).toHaveBeenCalledTimes(1)
  })

  it('busca de novo quando o cache venceu', async () => {
    const d = deps()
    await obterConfig(d)
    // `depois` reaproveita as dependências de `d`, inclusive o mesmo cache e o
    // mesmo espião de busca. Só o relógio muda, que é o que o teste isola.
    const depois = { ...d, agora: () => 1_000_000 + VALIDADE_MS + 1 }
    await obterConfig(depois)
    expect(d.buscar).toHaveBeenCalledTimes(2)
  })

  it('cai para a cópia embutida quando a rede falha', async () => {
    const d = deps({
      buscar: vi.fn(async () => {
        throw new Error('sem rede')
      }),
    })
    expect(await obterConfig(d)).toEqual(CONFIG_EMBUTIDA)
  })

  it('cai para a cópia embutida quando a resposta não é ok', async () => {
    const d = deps({ buscar: vi.fn(async () => resposta(REMOTA, false)) })
    expect(await obterConfig(d)).toEqual(CONFIG_EMBUTIDA)
  })

  it('cai para a cópia embutida quando o conteúdo não passa na validação', async () => {
    const d = deps({
      buscar: vi.fn(async () => resposta({ version: 'errado' })),
    })
    expect(await obterConfig(d)).toEqual(CONFIG_EMBUTIDA)
  })

  it('não guarda no cache o que reprovou na validação', async () => {
    const d = deps({ buscar: vi.fn(async () => resposta({ lixo: true })) })
    await obterConfig(d)
    expect(d.gravar).not.toHaveBeenCalled()
  })

  it('descarta cache gravado que não passe mais na validação', async () => {
    const memoria = new Map<string, unknown>([
      ['copyhaunt-config', { em: 1_000_000, config: { version: 'errado' } }],
    ])
    const d = deps({
      ler: vi.fn(async (c: string) => memoria.get(c)),
      buscar: vi.fn(async () => resposta(REMOTA)),
    })
    expect(await obterConfig(d)).toEqual(REMOTA)
    expect(d.buscar).toHaveBeenCalledTimes(1)
  })
})
