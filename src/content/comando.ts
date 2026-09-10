import { lerComandoFiltro, urlDoComando } from '../core/filtro'

/**
 * Aplica o filtro de data, navegando para a URL reescrita.
 *
 * Devolve `false` — sem navegar — quando o comando não presta ou quando a
 * página já está exatamente onde ele pede. Recarregar à toa custaria o
 * índice da sessão inteiro.
 */
export function tratarComandoFiltro(
  valor: unknown,
  urlAtual: string,
  agora: Date,
  navegar: (url: string) => void,
): boolean {
  const cmd = lerComandoFiltro(valor)
  if (!cmd) return false

  const destino = urlDoComando(cmd, urlAtual, agora)
  if (mesmaUrl(destino, urlAtual)) return false

  navegar(destino)
  return true
}

/** Compara URLs pelo destino, sem deixar a ordem dos parâmetros interferir. */
function mesmaUrl(esquerda: string, direita: string): boolean {
  const a = new URL(esquerda)
  const b = new URL(direita)
  a.searchParams.sort()
  b.searchParams.sort()
  return a.toString() === b.toString()
}
