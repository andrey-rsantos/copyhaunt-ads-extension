import { lerComandoFiltro, urlDoComando } from '../core/filtro'

/**
 * Os comandos que vêm do painel.
 *
 * O painel é deliberadamente burro (seção 5 do spec): manda o que o usuário
 * pediu e não sabe o que acontece depois. Quem decide é aqui.
 */

/**
 * A mensagem veio da janela do nosso painel?
 *
 * O main world é território compartilhado. Comparar a `source` com o
 * `contentWindow` do iframe que nós mesmos criamos é o que separa o nosso
 * painel de qualquer outro script que poste mensagem na mesma página.
 */
export function veioDoPainel(
  source: unknown,
  painel: HTMLIFrameElement | null,
): boolean {
  return painel !== null && source === painel.contentWindow
}

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
