import { salvarResultado } from '../storage/resultados'
import type { Progresso } from '../core/miner'
import type { Ad } from '../core/types'

export function urlDaPaginaResultados(): string {
  return chrome.runtime.getURL('src/resultados/index.html')
}

/**
 * O content script não abre a página sozinho: `window.open` com uma URL
 * `chrome-extension://` parte da origem da Meta e o Chrome bloqueia a
 * navegação (`ERR_BLOCKED_BY_CLIENT`). O service worker abre pela
 * própria extensão, sem `web_accessible_resources` nem permissão nova.
 */
export function abrirPaginaResultados(): void {
  void chrome.runtime.sendMessage({ tipo: 'abrir-resultados' })
}

export interface DependenciasFinalizacao {
  filtrar?: (anuncios: Ad[]) => Promise<Ad[]>
  salvar?: (resultado: {
    origem: string
    estado: Progresso['estado']
    salvoEm: Date
    anuncios: Ad[]
  }) => Promise<void>
  liberar?: () => void
  agora?: () => Date
}

export async function finalizarResultado(
  progresso: Progresso,
  aprovados: Ad[],
  origem: string,
  deps: DependenciasFinalizacao = {},
): Promise<Ad[] | null> {
  if (progresso.estado === 'pausado') return null

  const finais = deps.filtrar ? await deps.filtrar(aprovados) : aprovados
  try {
    const salvar = deps.salvar ?? salvarResultado
    await salvar({
      origem,
      estado: progresso.estado,
      salvoEm: deps.agora ? deps.agora() : new Date(),
      anuncios: finais,
    })
    deps.liberar?.()
    return finais
  } catch {
    return null
  }
}
