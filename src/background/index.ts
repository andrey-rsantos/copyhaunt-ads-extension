import {
  ehBuscarInstagramMensagem,
  origemBibliotecaValida,
  type BuscarInstagramMensagem,
  type RespostaInstagram,
} from '../core/instagram-ponte'
import { obterConfig } from './config-remota'

chrome.runtime.onInstalled.addListener(() => {
  console.info('[CopyHaunt] service worker instalado')
})

function abrirResultados(): void {
  void chrome.tabs.create({
    url: chrome.runtime.getURL('src/resultados/index.html'),
  })
}

chrome.action.onClicked.addListener(abrirResultados)

/** Resolve quando a aba termina de carregar; o listener sai no primeiro evento dela. */
function aguardarCarga(tabId: number): Promise<void> {
  return new Promise((resolver) => {
    let concluida = false
    const concluir = (): void => {
      if (concluida) return
      concluida = true
      chrome.tabs.onUpdated.removeListener(aoAtualizar)
      resolver()
    }
    const aoAtualizar = (id: number, info: { status?: string }): void => {
      if (id !== tabId || info.status !== 'complete') return
      concluir()
    }
    chrome.tabs.onUpdated.addListener(aoAtualizar)
    void chrome.tabs.get(tabId).then((aba) => {
      if (aba.status === 'complete') concluir()
    }).catch(() => {})
  })
}

/**
 * A página de resultados não pode consultar a Meta: abre-se a Biblioteca em
 * segundo plano e o content script de lá faz a busca. Só `ok/url` volta —
 * nunca HTML, token ou resposta bruta. A aba fica aberta para inspeção; sem
 * `tabs.query`, sem fechamento e sem permissão nova.
 */
async function intermediarInstagram(
  mensagem: BuscarInstagramMensagem,
): Promise<RespostaInstagram> {
  if (!origemBibliotecaValida(mensagem.origem)) {
    return { ok: false, motivo: 'origem-invalida' }
  }

  let aba: chrome.tabs.Tab
  try {
    aba = await chrome.tabs.create({ url: mensagem.origem, active: false })
    if (aba.id === undefined) throw new Error('aba sem id')
  } catch {
    return { ok: false, motivo: 'aba-indisponivel' }
  }

  try {
    await aguardarCarga(aba.id)
    const resposta: unknown = await chrome.tabs.sendMessage(aba.id, {
      tipo: 'buscar-instagram',
      pageId: mensagem.pageId,
    })
    return respostaControlada(resposta)
  } catch {
    return { ok: false, motivo: 'conteudo-indisponivel' }
  }
}

/** Repassa só o que o contrato prevê; qualquer outra forma vira falha. */
function respostaControlada(resposta: unknown): RespostaInstagram {
  if (typeof resposta !== 'object' || resposta === null) {
    return { ok: false, motivo: 'conteudo-indisponivel' }
  }
  const r = resposta as { ok?: unknown; url?: unknown }
  if (r.ok === true && (typeof r.url === 'string' || r.url === null)) {
    return { ok: true, url: r.url }
  }
  return { ok: false, motivo: 'conteudo-indisponivel' }
}

/**
 * O content script não busca a config sozinho: ele roda dentro de
 * `facebook.com` e ficaria sujeito à CSP da página. O service worker, com
 * `host_permissions`, não fica.
 *
 * O canal `chrome.runtime` é privado da extensão, então aqui não é preciso o
 * carimbo de namespace que `src/core/messages.ts` exige no main world.
 */
chrome.runtime.onMessage.addListener((mensagem, _remetente, responder) => {
  // O content script não consegue navegar para `chrome-extension://` a
  // partir da origem da Meta; só o service worker abre a página.
  if (mensagem?.tipo === 'abrir-resultados') {
    abrirResultados()
    return false
  }

  if (mensagem?.tipo === 'buscar-instagram') {
    if (!ehBuscarInstagramMensagem(mensagem)) {
      responder({ ok: false, motivo: 'origem-invalida' } satisfies RespostaInstagram)
      return false
    }
    void intermediarInstagram(mensagem).then(responder)
    return true
  }

  if (mensagem?.tipo !== 'obter-config') return false

  obterConfig({
    buscar: (...args) => fetch(...args),
    ler: async (chave) => (await chrome.storage.local.get(chave))[chave],
    gravar: async (chave, valor) =>
      chrome.storage.local.set({ [chave]: valor }),
    agora: () => Date.now(),
  }).then(responder)

  // `true` mantém o canal aberto para a resposta assíncrona.
  return true
})
