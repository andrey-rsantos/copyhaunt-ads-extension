import { montarUrlFiltro, type FaixaDias } from './dateFilter'

/**
 * O comando que o painel manda e o content script obedece.
 *
 * Módulo puro, e a fronteira de confiança do recurso: `lerComandoFiltro`
 * recebe o que veio de `postMessage`, que qualquer script da página pode ter
 * escrito, e só deixa passar o que for exatamente isto.
 */

export type ComandoFiltro = FaixaDias

/**
 * Um ano. Acima disso o corte deixa de filtrar coisa alguma: a Biblioteca só
 * guarda anúncios ativos, e nenhum está no ar desde antes disso.
 */
export const DIAS_MAX = 365

/** Um lado da faixa: inteiro entre 1 e DIAS_MAX, ou ausente. */
function ladoValido(valor: unknown): number | null | undefined {
  if (valor === null || valor === undefined) return null
  if (typeof valor !== 'number' || !Number.isInteger(valor)) return undefined
  if (valor < 1 || valor > DIAS_MAX) return undefined
  return valor
}

/** O comando, ou `null` se o que chegou não for um. */
export function lerComandoFiltro(valor: unknown): ComandoFiltro | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return null
  }

  const bruto = valor as Record<string, unknown>
  if (!Object.hasOwn(bruto, 'diasMin') || !Object.hasOwn(bruto, 'diasMax')) {
    return null
  }
  const diasMin = ladoValido(bruto.diasMin)
  const diasMax = ladoValido(bruto.diasMax)
  if (diasMin === undefined || diasMax === undefined) return null
  if (diasMax !== null) return null

  // Faixa invertida não filtra nada: devolveria a interseção vazia.
  if (diasMin !== null && diasMax !== null && diasMin > diasMax) return null

  return { diasMin, diasMax }
}

/** A URL da Biblioteca com a faixa do comando aplicada. */
export function urlDoComando(
  cmd: ComandoFiltro,
  urlAtual: string,
  agora: Date,
): string {
  return montarUrlFiltro(urlAtual, cmd, agora)
}
