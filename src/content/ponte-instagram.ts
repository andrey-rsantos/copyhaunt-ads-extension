import type { RespostaInstagram } from '../core/instagram-ponte'

export interface DependenciasPonteInstagram {
  /** A config remota traz o `doc_id`; sem ela a consulta nem sai. */
  aguardarConfig: () => Promise<void>
  buscar: (pageId: string) => Promise<string | null>
}

/**
 * Atende o comando que o service worker manda para esta aba da Biblioteca.
 *
 * Devolve só `ok/url`. Nunca HTML, token, resposta bruta nem mensagem de
 * exceção: o que sai daqui atravessa para a página de resultados.
 */
export async function atenderBuscaInstagram(
  mensagem: unknown,
  deps: DependenciasPonteInstagram,
): Promise<RespostaInstagram> {
  const m = mensagem as { tipo?: unknown; pageId?: unknown } | null
  if (
    m?.tipo !== 'buscar-instagram' ||
    typeof m.pageId !== 'string' ||
    m.pageId === ''
  ) {
    return { ok: false, motivo: 'conteudo-indisponivel' }
  }

  try {
    await deps.aguardarConfig()
    return { ok: true, url: await deps.buscar(m.pageId) }
  } catch {
    return { ok: false, motivo: 'conteudo-indisponivel' }
  }
}
