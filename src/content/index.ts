import { isCopyHauntMessage } from '../core/messages'
import { AdStore } from '../core/store'
import type { Captura } from '../interceptor/xhr-patch'
import { processarCaptura } from './pipeline'

/** Índice da sessão. Vive enquanto a aba viver. */
const store = new AdStore()

const PANEL_ID = 'copyhaunt-panel'

/** Monta o painel num iframe, que isola o CSS da página da Meta. */
function mountPanel(): void {
  if (document.getElementById(PANEL_ID)) return

  const frame = document.createElement('iframe')
  frame.id = PANEL_ID
  frame.src = chrome.runtime.getURL('src/panel/index.html')
  frame.style.cssText = [
    'position:fixed',
    'top:16px',
    'right:16px',
    'width:320px',
    'height:180px',
    'border:0',
    'border-radius:14px',
    'z-index:2147483647',
    'box-shadow:0 0 20px rgba(124, 58, 237, 0.18)',
  ].join(';')

  document.documentElement.appendChild(frame)
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (!isCopyHauntMessage(event.data)) return

  if (event.data.kind === 'interceptor-ready') {
    console.info('[CopyHaunt] interceptador confirmado pelo content script')
    return
  }

  if (event.data.kind === 'raw-capture') {
    const resultado = processarCaptura(event.data.payload as Captura, store)
    if (resultado.novos > 0) {
      console.info(`[CopyHaunt] indexados: ${resultado.total}`)
    }
  }
})

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountPanel, { once: true })
} else {
  mountPanel()
}

console.info('[CopyHaunt] content script ativo')
