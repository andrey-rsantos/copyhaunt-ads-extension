import {
  CHAVE_RESULTADO,
  hidratarResultado,
  serializarResultado,
  type ResultadoLocal,
} from '../core/resultados'

export interface StorageLocal {
  get(chave: string): Promise<unknown>
  set(chave: string, valor: unknown): Promise<void>
}

export function criarStorageChrome(): StorageLocal {
  return {
    get: async (chave) => (await chrome.storage.local.get(chave))[chave],
    set: async (chave, valor) => {
      await chrome.storage.local.set({ [chave]: valor })
    },
  }
}

export async function salvarResultado(
  resultado: ResultadoLocal,
  storage: StorageLocal = criarStorageChrome(),
): Promise<void> {
  try {
    await storage.set(CHAVE_RESULTADO, serializarResultado(resultado))
  } catch (erro) {
    console.error('[CopyHaunt] resultados: falha ao ler/gravar')
    throw erro
  }
}

export async function carregarResultado(
  storage: StorageLocal = criarStorageChrome(),
): Promise<ResultadoLocal | null> {
  try {
    return hidratarResultado(await storage.get(CHAVE_RESULTADO))
  } catch {
    console.error('[CopyHaunt] resultados: falha ao ler/gravar')
    return null
  }
}

/**
 * Fila local: duas atualizações ao mesmo tempo leriam o mesmo snapshot e a
 * segunda gravação apagaria a primeira. Encadear na Promise de módulo basta —
 * é uma página, um storage.
 */
let fila: Promise<unknown> = Promise.resolve()

/**
 * Grava o Instagram encontrado em todos os anúncios daquele anunciante.
 *
 * Devolve `false` sem snapshot ou sem o `pageId`: nunca cria resultado novo.
 * Rejeição do storage sobe, para a UI mostrar falha em vez de fingir.
 */
export function atualizarInstagramResultado(
  pageId: string,
  instagram: string,
  storage: StorageLocal = criarStorageChrome(),
): Promise<boolean> {
  const operacao = fila.then(async () => {
    const atual = await carregarResultado(storage)
    if (!atual || !atual.anuncios.some((a) => a.anunciante.pageId === pageId)) {
      return false
    }
    await salvarResultado(
      {
        ...atual,
        anuncios: atual.anuncios.map((a) =>
          a.anunciante.pageId === pageId
            ? { ...a, anunciante: { ...a.anunciante, instagram } }
            : a,
        ),
      },
      storage,
    )
    return true
  })
  // A fila segue mesmo se esta operação rejeitar; o erro é de quem chamou.
  fila = operacao.catch(() => {})
  return operacao
}
