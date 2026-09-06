import type { Criterios } from '../core/criteria'
import { isCopyHauntMessage } from '../core/messages'
import { AdStore } from '../core/store'
import type { Captura } from '../interceptor/xhr-patch'
import { observarGrade, type Observacao } from './observer'
import { pintarGrade } from './overlay'
import { processarCaptura, processarSsr } from './pipeline'

/** Índice da sessão. Vive enquanto a aba viver. */
const store = new AdStore()

/**
 * Fora da mineração, nenhum critério é aplicado: o overlay só planta bandeja
 * e badge. Filtrar por escala é trabalho do Bloco B, quando centenas de
 * anúncios já acumularam.
 *
 * Medido: numa sessão de 27 anúncios, colação ≥ 5 e presença ≥ 10 reprovam
 * todos. Aplicá-los na primeira tela faria a extensão parecer quebrada.
 */
const SEM_CRITERIOS: Criterios = {
  colacaoMinima: null,
  diasMin: null,
  diasMax: null,
  presencaMinima: null,
}

let observacao: Observacao | null = null

/** Repinta a grade inteira. Idempotente: bandeja já plantada não duplica. */
function repintar(): void {
  const r = pintarGrade(document.body, store, SEM_CRITERIOS, new Date(), false)
  if (r.plantados > 0) {
    console.info(`[CopyHaunt] pintados: ${r.plantados}`)
  }
  garantirObservador()
}

/**
 * Observa o documento para replantar o que a Meta reciclar.
 *
 * Sem isto as bandejas somem na rolagem: medido que após três rolagens
 * nenhuma sobrevive, porque a Meta virtualiza a grade — tira do DOM os cards
 * fora da tela e recria depois.
 *
 * A seção 6 do spec recomenda observar apenas o container da grade, por
 * performance. Não dá: ao virtualizar, a Meta troca o próprio container, e o
 * observador fica preso num nó desanexado sem nunca mais disparar — foi
 * exatamente o que aconteceu na primeira tentativa. O `body` sobrevive a
 * tudo, e o agrupamento de 300ms segura o custo.
 */
function garantirObservador(): void {
  if (observacao) return
  observacao = observarGrade(document.body, repintar, 300)
}

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

/**
 * Lê o lote que a Meta embutiu no HTML da primeira carga.
 *
 * Roda uma vez só. O script é servido com a página e não muda depois; a
 * paginação seguinte volta a ser XHR, que o interceptador já pega. Reler a
 * cada mutação seria parsear 179 kB por rolagem, para nada.
 */
function lerLoteInicial(): void {
  const r = processarSsr(document, store)
  if (r.novos > 0) {
    console.info(`[CopyHaunt] lote do HTML: ${r.novos} | índice: ${r.total}`)
  }
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
      repintar()
    }
  }
})

/**
 * O content script roda em `document_start`, quando `document.body` ainda não
 * existe — observar ali daria em nada. E os payloads chegam antes de a Meta
 * renderizar os cards, então a primeira pintura também precisa esperar.
 */
function iniciar(): void {
  mountPanel()
  lerLoteInicial()
  garantirObservador()
  repintar()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar, { once: true })
} else {
  iniciar()
}

console.info('[CopyHaunt] content script ativo')
