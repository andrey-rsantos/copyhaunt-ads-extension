import type { Criterios } from '../core/criteria'
import { relogioDeWorker } from '../core/clock'
import { createMessage, isCopyHauntMessage } from '../core/messages'
import { Minerador } from '../core/miner'
import { AdStore } from '../core/store'
import type { Captura } from '../interceptor/xhr-patch'
import { lerFaixaDaUrl, montarUrlFiltro, rotuloDaFaixa } from '../core/dateFilter'
import { precisaOrdenar, urlOrdenada } from '../core/ordenacao'
import { acharCards, definirPadraoAncora } from './anchor'
import { plantarEnxertos, type Enxerto, type Plantio } from './enxertos'
import { alternarGaveta, fecharGaveta } from './gaveta'
import { escreverNaBusca, montarExemplos } from './gaveta-exemplos'
import { montarCalendario } from './gaveta-calendario'
import { montarMinerar, type PedidoMineracao } from './gaveta-minerar'
import { buscarInstagram, definirDocIdAnunciante } from './instagram'
import { observarGrade, type Observacao } from './observer'
import { pintarGrade } from './overlay'
import { processarCaptura, processarSsr } from './pipeline'
import { filtrarPorInstagram } from './pos-instagram'
import { atualizarProgresso, liberarResultados, montarProgresso } from './progresso'
import {
  abrirPaginaResultados,
  finalizarResultado,
} from './resultados'

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
      const cartao = plantio
        ?.hospedeiro()
        ?.shadowRoot?.querySelector<HTMLElement>('[data-chave="progresso"]')
      if (cartao) atualizarProgresso(cartao, p, alvoAtual)
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
  // A única fonte legítima é o main world, que manda capturas.
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
      minerador?.avisarLote()
      repintar()
    }
  }
})

/** O plantio dos enxertos. Vive enquanto a aba viver. */
let plantio: Plantio | null = null

/** O alvo da mineração em curso, para a barra de progresso ter denominador. */
let alvoAtual = 100

/**
 * Troca o botão Minerar pelo cartão de progresso, e o mantém atualizado.
 *
 * O cartão é replantado junto com os enxertos: quando a Meta refaz a barra, o
 * host novo não tem cartão, e sem isto o progresso sumiria no meio da
 * varredura.
 */
function mostrarProgresso(shadow: ShadowRoot): HTMLElement | null {
  fecharGaveta(shadow)

  const botao = shadow.querySelector<HTMLElement>('[data-chave="minerar"]')
  if (!botao) return null

  const cartao = montarProgresso(
    document,
    () => {
      const p = minerador?.progresso()
      if (p?.estado === 'pausado') void minerador?.iniciar()
      else minerador?.parar()
    },
    abrirPaginaResultados,
  )
  cartao.dataset.chave = 'progresso'
  botao.replaceWith(cartao)
  return cartao
}

/** Um enxerto por gaveta, mais o disparo. */
function montarEnxertos(): Enxerto[] {
  return [
    {
      chave: 'ajuda',
      glifo: '?',
      titulo: 'Exemplos de busca',
      variante: 'contorno',
      aoClicar: (botao) => {
        const shadow = botao.getRootNode() as ShadowRoot
        alternarGaveta(shadow, botao, () =>
          montarExemplos(document, (termo) => {
            escreverNaBusca(document, termo)
            fecharGaveta(shadow)
          }),
        )
      },
    },
    {
      chave: 'calendario',
      glifo: rotuloDaFaixa(lerFaixaDaUrl(location.href, new Date())),
      titulo: 'Tempo ativo',
      variante: 'contorno',
      aoClicar: (botao) => {
        const shadow = botao.getRootNode() as ShadowRoot
        const agora = new Date()
        alternarGaveta(shadow, botao, () =>
          montarCalendario(document, lerFaixaDaUrl(location.href, agora), (f) => {
            location.assign(montarUrlFiltro(location.href, f, new Date()))
          }),
        )
      },
    },
    {
      chave: 'minerar',
      glifo: 'Minerar',
      titulo: 'Minerar',
      variante: 'solido',
      aoClicar: (botao) => {
        const shadow = botao.getRootNode() as ShadowRoot
        alternarGaveta(shadow, botao, () =>
          montarMinerar(document, location.href, new Date(), (pedido) => {
            dispararMineracao(pedido, shadow)
          }),
        )
      },
    },
  ]
}

/**
 * O que acontece ao apertar Iniciar.
 *
 * A ordenação é verificada com a URL **em vigor agora** — a Meta já a
 * reescreveu ao carregar, e decidir com a URL digitada recarregaria à toa. A
 * recarga descarta o `AdStore`, que ainda está vazio neste instante, então
 * não custa nada (spec, 7.6).
 */
function dispararMineracao(pedido: PedidoMineracao, shadow: ShadowRoot): void {
  if (precisaOrdenar(location.href)) {
    location.assign(urlOrdenada(location.href))
    return
  }

  alvoAtual = pedido.limiteEncontrados
  const cartao = mostrarProgresso(shadow)
  const motor = iniciarMineracao(pedido)

  // O pós-filtro só roda quando o laço termina — a trava da seção 6.4.
  void motor.iniciar().then(async () => {
    const p = motor.progresso()
    if (p.estado === 'pausado') return

    const relogio = relogioDeWorker()
    const finais = await finalizarResultado(
      p,
      motor.encontrados(),
      location.href,
      {
        filtrar: pedido.exigirInstagram
          ? (aprovados) =>
              filtrarPorInstagram(aprovados, {
                consultar: (pageId) =>
                  buscarInstagram(pageId, {
                    buscar: (...args) => fetch(...args),
                    html: () => document.documentElement.innerHTML,
                  }),
                esperar: (ms) => relogio.esperar(ms),
                aoProgredir: (feitos, total) => {
                  console.info(
                    `[CopyHaunt] Instagram: ${feitos} de ${total} anunciantes`,
                  )
                },
              })
          : async (aprovados) => aprovados,
        liberar: () => {
          if (cartao) liberarResultados(cartao)
        },
      },
    )

    if (!finais) return
    console.info(
      `[CopyHaunt] mineração encerrada em ${p.estado}: ${finais.length} aprovados finais`,
    )
  })
}

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
  plantio = plantarEnxertos(document, montarEnxertos())
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
