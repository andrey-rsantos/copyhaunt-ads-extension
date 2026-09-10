import type { Criterios } from '../core/criteria'
import { relogioDeWorker } from '../core/clock'
import { createMessage, isCopyHauntMessage } from '../core/messages'
import { Minerador } from '../core/miner'
import { AdStore } from '../core/store'
import type { Captura } from '../interceptor/xhr-patch'
import { acharCards, definirPadraoAncora } from './anchor'
import { definirDocIdAnunciante } from './instagram'
import { observarGrade, type Observacao } from './observer'
import { pintarGrade } from './overlay'
import { processarCaptura, processarSsr } from './pipeline'
import { tratarComandoFiltro, veioDoPainel } from './comando'

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

/** O ritmo de fábrica. A config remota pode substituí-lo. */
let ritmo = { pisoMs: 2500, timeoutMs: 4500, jitter: 0.4 }

let minerador: Minerador | null = null

/** Monta o motor com os efeitos reais do navegador ligados. */
export function criarMinerador(
  storeAtual: AdStore,
  criterios: Criterios,
  limiteEncontrados: number,
  ritmoAtual: { pisoMs: number; timeoutMs: number; jitter: number },
): Minerador {
  return new Minerador({
    store: storeAtual,
    criterios,
    relogio: relogioDeWorker(),
    rolar: () => window.scrollBy(0, window.innerHeight * 0.9),
    pisoMs: ritmoAtual.pisoMs,
    timeoutMs: ritmoAtual.timeoutMs,
    jitter: ritmoAtual.jitter,
    maxRolagens: 400,
    limiteEncontrados,
    alturaDaPagina: () => document.documentElement.scrollHeight,
    cardsNaTela: () => acharCards(document.body).size,
    aoProgredir: (p) => {
      console.info(
        `[CopyHaunt] ${p.estado}: ${p.encontrados} de ${limiteEncontrados} encontrados; ${p.analisados} analisados em ${p.rolagens} rolagens`,
      )
    },
  })
}

/** Inicia ou retoma a única mineração desta sessão. */
export function iniciarMineracao(pedido: {
  criterios: Criterios
  limiteEncontrados: number
}): Minerador {
  minerador ??= criarMinerador(
    store,
    pedido.criterios,
    pedido.limiteEncontrados,
    ritmo,
  )
  void minerador.iniciar()
  return minerador
}

// Porta provisória para o teste manual no contexto do content script. A
// futura gaveta chama a mesma função e elimina a necessidade do console.
Object.assign(globalThis, { iniciarMineracao })

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

/**
 * Pede a config ao service worker e aplica o que dela depende.
 *
 * Não bloqueia a subida: a extensão começa com o padrão de fábrica e troca
 * quando a resposta chegar. Esperar pela rede para pintar o primeiro card
 * seria trocar um risco raro por uma lentidão certa.
 */
function aplicarConfig(): void {
  chrome.runtime.sendMessage({ tipo: 'obter-config' }, (config) => {
    if (chrome.runtime.lastError || !config?.anchors?.libraryIdPattern) return
    definirPadraoAncora(config.anchors.libraryIdPattern)
    // Sem este campo, a consulta forjada nem sai. É o interruptor remoto do
    // recurso: apagar o campo do arquivo hospedado o desliga em minutos.
    definirDocIdAnunciante(config.advertiserDocId)
    if (config.mining) ritmo = config.mining
  })
}

const PANEL_ID = 'copyhaunt-panel'
let painel: HTMLIFrameElement | null = null

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
    'height:220px',
    'border:0',
    'border-radius:14px',
    'z-index:2147483647',
    'box-shadow:0 0 20px rgba(124, 58, 237, 0.18)',
  ].join(';')

  painel = frame
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
  // Duas fontes legítimas, e nenhuma outra: o main world, que manda capturas,
  // e o iframe do painel, que manda comandos.
  const doPainel = veioDoPainel(event.source, painel)
  if (event.source !== window && !doPainel) return
  if (!isCopyHauntMessage(event.data)) return

  if (event.data.kind === 'interceptor-ready') {
    console.info('[CopyHaunt] interceptador confirmado pelo content script')
    return
  }

  if (doPainel && event.data.kind === 'panel-command') {
    tratarComandoFiltro(
      event.data.payload,
      location.href,
      new Date(),
      (url) => location.assign(url),
    )
    return
  }

  if (event.data.kind === 'raw-capture') {
    const resultado = processarCaptura(event.data.payload as Captura, store)
    if (resultado.novos > 0) {
      console.info(`[CopyHaunt] indexados: ${resultado.total}`)
      minerador?.avisarLote()
      repintar()
    }
  }
})

// O interceptador pode ter anunciado antes de este listener existir. O
// handshake pede a confirmação novamente e elimina essa corrida de carga.
window.postMessage(createMessage('content-ready', {}), location.origin)

/**
 * O content script roda em `document_start`, quando `document.body` ainda não
 * existe — observar ali daria em nada. E os payloads chegam antes de a Meta
 * renderizar os cards, então a primeira pintura também precisa esperar.
 */
function iniciar(): void {
  aplicarConfig()
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
