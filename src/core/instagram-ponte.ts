/**
 * O contrato da ponte entre a página de resultados e a Biblioteca.
 *
 * A página não faz `fetch` para a Meta: ela pede ao service worker, que abre
 * a Biblioteca e repassa o comando ao content script de lá. Por aqui só
 * trafegam `pageId`, origem e a URL encontrada — nunca HTML, token ou
 * resposta bruta.
 */

export interface BuscarInstagramMensagem {
  tipo: 'buscar-instagram'
  pageId: string
  origem: string
}

export type RespostaInstagram =
  | { ok: true; url: string | null }
  | {
      ok: false
      motivo: 'origem-invalida' | 'aba-indisponivel' | 'conteudo-indisponivel'
    }

/** Só a Biblioteca, em HTTPS: é a única página que o worker aceita abrir. */
export function origemBibliotecaValida(origem: string): boolean {
  try {
    const url = new URL(origem)
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'facebook.com' || url.hostname === 'www.facebook.com') &&
      url.pathname === '/ads/library/'
    )
  } catch {
    return false
  }
}

export function ehBuscarInstagramMensagem(
  mensagem: unknown,
): mensagem is BuscarInstagramMensagem {
  if (typeof mensagem !== 'object' || mensagem === null) return false
  const m = mensagem as Record<string, unknown>
  return (
    m.tipo === 'buscar-instagram' &&
    typeof m.pageId === 'string' &&
    m.pageId !== '' &&
    typeof m.origem === 'string'
  )
}
