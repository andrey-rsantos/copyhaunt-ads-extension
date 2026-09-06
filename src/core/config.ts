/**
 * A config remota: os valores que a Meta pode mudar sem aviso.
 *
 * **Somente dados, nunca código.** Nada daqui é executado — a proibição de
 * código remoto do MV3 é o que torna esta abordagem legítima, e é ela que
 * separa "config" de "carregar script de fora".
 */
export interface ConfigRemota {
  version: number
  anchors: {
    /** Padrão que acha o ID da biblioteca no texto do card. */
    libraryIdPattern: string
  }
}

/**
 * O padrão de expressão regular vem de fora, e expressão regular mal escrita
 * trava a aba por backtracking. Um teto de tamanho não impede toda armadilha,
 * mas descarta o caso grosseiro sem custo.
 *
 * ponytail: teto simples de tamanho, não análise de complexidade. Se algum dia
 * a config trouxer padrões grandes de propósito, medir o tempo de execução
 * contra uma entrada de teste antes de adotar.
 */
const TAMANHO_MAXIMO_PADRAO = 500

/**
 * A cópia que viaja no pacote.
 *
 * É para onde a extensão cai quando a busca falha ou o conteúdo não passa na
 * validação. Sem ela, uma indisponibilidade do arquivo deixaria a extensão sem
 * saber ancorar nada.
 */
export const CONFIG_EMBUTIDA: ConfigRemota = {
  version: 0,
  anchors: { libraryIdPattern: '(?<!\\d)(\\d{15,17})(?!\\d)' },
}

/**
 * Devolve uma config confiável, ou `null`.
 *
 * Copia campo a campo de propósito: o que chega de fora entra na extensão
 * apenas pelas portas que esta função abre, e um arquivo comprometido não
 * consegue contrabandear chave nenhuma para dentro do objeto.
 */
export function validarConfig(bruto: unknown): ConfigRemota | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const raiz = bruto as Record<string, unknown>

  if (typeof raiz.version !== 'number') return null

  const anchors = raiz.anchors
  if (typeof anchors !== 'object' || anchors === null) return null

  const padrao = (anchors as Record<string, unknown>).libraryIdPattern
  if (typeof padrao !== 'string') return null
  if (padrao.length === 0 || padrao.length > TAMANHO_MAXIMO_PADRAO) return null

  // Um padrão que não compila derrubaria a ancoragem de todos os cards.
  try {
    new RegExp(padrao)
  } catch {
    return null
  }

  return { version: raiz.version, anchors: { libraryIdPattern: padrao } }
}
