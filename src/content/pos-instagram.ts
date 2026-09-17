import type { Ad } from '../core/types'

/**
 * O pós-filtro de Instagram, sobre os aprovados (spec, 6.4).
 *
 * **Depois do laço, nunca dentro dele.** Como critério de mineração, obrigaria
 * consultar todo anunciante encontrado: a medição de 2026-09-10 viu 806
 * anúncios em 4 minutos, algo como 200 anunciantes distintos, logo 200
 * requisições forjadas em 4 minutos. É exatamente a varredura que a seção 2
 * do spec proíbe. Sobre os aprovados são dezoito.
 *
 * Duas economias que fazem a diferença entre "algumas consultas" e "uma
 * varredura": agrupar por anunciante, porque vários aprovados costumam ser do
 * mesmo, e espaçar as consultas — cada uma nasce hoje de um clique humano, e
 * um laço de dezoito seguidas não se parece com isso.
 */

export interface DepsPosFiltro {
  /** A consulta em si. Em produção, `buscarInstagram`. */
  consultar: (pageId: string) => Promise<string | null>
  esperar: (ms: number) => Promise<void>
  /**
   * Espaço entre consultas.
   *
   * ponytail: valor fixo, sem jitter. O laço da mineração espalha a cadência
   * porque roda centenas de vezes; aqui são dezoito. Se virar sinal, reusar
   * `esperaComJitter` de `miner.ts`.
   */
  espacoMs?: number
  aoProgredir?: (feitos: number, total: number) => void
}

const ESPACO_PADRAO_MS = 2000

export async function filtrarPorInstagram(
  aprovados: Ad[],
  deps: DepsPosFiltro,
): Promise<Ad[]> {
  const espaco = deps.espacoMs ?? ESPACO_PADRAO_MS

  // Um anunciante pode ter vários aprovados; a consulta é por anunciante.
  const paginas = [...new Set(aprovados.map((a) => a.anunciante.pageId))]
  if (paginas.length === 0) return []

  const perfis = new Map<string, string | null>()
  const consultaFalhou = new Set<string>()

  for (const [i, pageId] of paginas.entries()) {
    if (i > 0) await deps.esperar(espaco)

    try {
      const perfil = await deps.consultar(pageId)
      perfis.set(pageId, perfil)
    } catch {
      // Falha de rede não é ausência de Instagram. Descartar aqui apagaria um
      // aprovado legítimo por causa de um erro nosso; manter deixa o filtro
      // um pouco permissivo, que é o lado certo para errar.
      consultaFalhou.add(pageId)
    }

    deps.aoProgredir?.(i + 1, paginas.length)
  }

  return aprovados
    .filter((a) => consultaFalhou.has(a.anunciante.pageId) || perfis.get(a.anunciante.pageId))
    .map((a) => {
      const perfil = perfis.get(a.anunciante.pageId)
      if (!perfil) return a
      return {
        ...a,
        anunciante: { ...a.anunciante, instagram: perfil },
      }
    })
}
