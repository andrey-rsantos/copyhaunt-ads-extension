import { montarUrlFiltro, type ModoFiltro } from './dateFilter'

/**
 * O comando que o painel manda e o content script obedece.
 *
 * Módulo puro, e a fronteira de confiança do recurso: `lerComandoFiltro`
 * recebe o que veio de `postMessage`, que qualquer script da página pode ter
 * escrito, e só deixa passar o que for exatamente isto.
 */

export interface ComandoFiltro {
  modo: ModoFiltro
  dias: number
}

/**
 * Um ano. Acima disso o corte deixa de filtrar coisa alguma: a Biblioteca só
 * guarda anúncios ativos, e nenhum está no ar desde antes disso.
 */
export const DIAS_MAX = 365

const MODOS: readonly string[] = ['provadas', 'subindo']

/** O comando, ou `null` se o que chegou não for um. */
export function lerComandoFiltro(valor: unknown): ComandoFiltro | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return null
  }

  const { modo, dias } = valor as Record<string, unknown>

  if (typeof modo !== 'string' || !MODOS.includes(modo)) return null
  if (typeof dias !== 'number' || !Number.isInteger(dias)) return null
  if (dias < 1 || dias > DIAS_MAX) return null

  return { modo: modo as ModoFiltro, dias }
}

/** A URL da Biblioteca com o corte do comando aplicado. */
export function urlDoComando(
  cmd: ComandoFiltro,
  urlAtual: string,
  agora: Date,
): string {
  return montarUrlFiltro(urlAtual, cmd.modo, cmd.dias, agora)
}
