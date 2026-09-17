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
