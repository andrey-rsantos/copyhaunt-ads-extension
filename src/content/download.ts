import JSZip from 'jszip'
import { nomeDoArquivo, nomeDoPacote, nomeNoPacote } from '../core/baixar'
import type { Ad, Midia } from '../core/types'

/**
 * Baixar os criativos do anúncio.
 *
 * Roda no content script, e é lá que precisa rodar: por estar em mundo
 * isolado, ele não sofre a CSP da página. E o fbcdn responde
 * `Access-Control-Allow-Origin: *` a qualquer origem (Spike 1, seção 4 do
 * spec), então um `fetch` comum basta — sem `host_permissions` no CDN, sem
 * regra de DNR, sem a permissão `downloads`.
 */

export interface Dependencias {
  buscar: typeof fetch
  /** Entrega o arquivo ao usuário. Injetado para testar sem navegador. */
  salvar: (blob: Blob, nome: string) => void
}

interface Baixada {
  midia: Midia
  blob: Blob
}

/**
 * Busca uma mídia. `null` quando ela não vem.
 *
 * Falha isolada por mídia de propósito: num carrossel de dez, uma URL expirada
 * não pode custar as outras nove.
 */
async function baixarUma(
  midia: Midia,
  deps: Dependencias,
): Promise<Blob | null> {
  try {
    const resposta = await deps.buscar(midia.alta)
    return resposta.ok ? await resposta.blob() : null
  } catch {
    return null
  }
}

/**
 * Baixa os criativos e entrega ao usuário: arquivo solto quando é um só, ZIP
 * quando são vários.
 *
 * Nunca lança. Não achou nada, não salva nada — o botão simplesmente não
 * produz arquivo, e isso é preferível a um erro na cara de quem só queria um
 * vídeo.
 */
export async function baixarCriativos(
  ad: Ad,
  deps: Dependencias,
): Promise<void> {
  if (ad.midias.length === 0) return

  const tentativas = await Promise.all(
    ad.midias.map(async (midia) => ({
      midia,
      blob: await baixarUma(midia, deps),
    })),
  )
  const boas = tentativas.filter((t): t is Baixada => t.blob !== null)

  if (boas.length === 0) return

  // Um arquivo só não vira ZIP: obrigar o usuário a descompactar um vídeo
  // seria cobrar um passo por nada.
  if (boas.length === 1) {
    deps.salvar(boas[0].blob, nomeDoArquivo(ad, boas[0].midia))
    return
  }

  const zip = new JSZip()
  // `ArrayBuffer` e não o `Blob`: o JSZip reconhece Blob por `instanceof`, e
  // isso quebra quando o Blob nasce em outro realm — é o que acontece sob o
  // jsdom dos testes. O buffer é aceito em qualquer ambiente, e o conteúdo já
  // estava em memória de todo modo.
  for (const [i, { midia, blob }] of boas.entries()) {
    zip.file(nomeNoPacote(i, midia), await blob.arrayBuffer())
  }

  // Sem compressão, que é o padrão do JSZip: MP4 e JPEG já vêm comprimidos, e
  // passá-los pelo deflate custa tempo de CPU para não economizar byte nenhum.
  deps.salvar(await zip.generateAsync({ type: 'blob' }), nomeDoPacote(ad))
}
