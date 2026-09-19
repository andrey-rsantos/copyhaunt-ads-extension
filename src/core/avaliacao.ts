import type { StorageLocal } from '../storage/resultados'

export const CHAVE_AVALIACAO = 'copyhaunt:avaliacao:v1'
export const INTERVALO_AVALIACAO_MS = 5 * 24 * 60 * 60 * 1000
export const LINK_AVALIACAO =
  'https://chromewebstore.google.com/detail/copyhaunt-ads/hpohpmpmedpnldmgpegdilmdmejjlfge/reviews'

export interface RegistroAvaliacaoV1 {
  versao: 1
  primeiroUsoEm: string
  ultimoPedidoEm?: string
  naoMostrarNovamente: boolean
}

export type StorageAvaliacao = StorageLocal

function dataValida(valor: unknown): valor is string {
  return typeof valor === 'string' && Number.isFinite(new Date(valor).getTime())
}

function lerRegistro(valor: unknown): RegistroAvaliacaoV1 | null {
  if (typeof valor !== 'object' || valor === null) return null

  const registro = valor as Partial<RegistroAvaliacaoV1>
  if (
    registro.versao !== 1 ||
    !dataValida(registro.primeiroUsoEm) ||
    typeof registro.naoMostrarNovamente !== 'boolean'
  ) {
    return null
  }

  if (registro.ultimoPedidoEm !== undefined && !dataValida(registro.ultimoPedidoEm)) {
    return null
  }

  return registro as RegistroAvaliacaoV1
}

function registroInicial(agora: Date): RegistroAvaliacaoV1 {
  return {
    versao: 1,
    primeiroUsoEm: agora.toISOString(),
    naoMostrarNovamente: false,
  }
}

export async function considerarPedidoAvaliacao(
  agora: Date,
  storage: StorageAvaliacao,
): Promise<boolean> {
  if (!Number.isFinite(agora.getTime())) return false

  const registro = lerRegistro(await storage.get(CHAVE_AVALIACAO))
  if (!registro) {
    await storage.set(CHAVE_AVALIACAO, registroInicial(agora))
    return false
  }

  if (registro.naoMostrarNovamente) return false

  const referencia = new Date(
    registro.ultimoPedidoEm ?? registro.primeiroUsoEm,
  ).getTime()
  if (agora.getTime() - referencia < INTERVALO_AVALIACAO_MS) return false

  await storage.set(CHAVE_AVALIACAO, {
    ...registro,
    ultimoPedidoEm: agora.toISOString(),
  } satisfies RegistroAvaliacaoV1)
  return true
}

export async function desativarPedidoAvaliacao(
  storage: StorageAvaliacao,
): Promise<void> {
  const registro = lerRegistro(await storage.get(CHAVE_AVALIACAO))
  if (!registro || registro.naoMostrarNovamente) return

  await storage.set(CHAVE_AVALIACAO, {
    ...registro,
    naoMostrarNovamente: true,
  } satisfies RegistroAvaliacaoV1)
}
