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
