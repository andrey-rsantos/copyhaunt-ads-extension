import type { Criterios } from '../core/criteria'
import { relogioDeWorker } from '../core/clock'
import { createMessage, isCopyHauntMessage } from '../core/messages'
import { Minerador } from '../core/miner'
import { AdStore } from '../core/store'
import type { Captura } from '../interceptor/xhr-patch'
import {
  lerFaixaDaUrl,
  lerFaixaPersistida,
  montarUrlFiltro,
  rotuloDaFaixa,
  salvarFaixaPersistida,
  type FaixaDias,
} from '../core/dateFilter'
import { precisaOrdenar, urlOrdenada } from '../core/ordenacao'
import { acharCards, definirPadraoAncora } from './anchor'
import { criarAgendadorRepintura } from './agendamento'
import { iniciarQuandoHouverBody } from './arranque'
import {
  montarBotao,
  plantarEnxertos,
  type Enxerto,
  type Plantio,
} from './enxertos'
import { abrirGaveta, alternarGaveta, fecharGaveta } from './gaveta'
import { escreverNaBusca, montarExemplos } from './gaveta-exemplos'
import { montarCalendario } from './gaveta-calendario'
import { montarMinerar, type PedidoMineracao } from './gaveta-minerar'
import { buscarInstagram, definirDocIdAnunciante } from './instagram'
import { observarGrade, type Observacao } from './observer'
import { pintarGrade } from './overlay'
import { processarCaptura, processarSsr } from './pipeline'
import { atenderBuscaInstagram } from './ponte-instagram'
import { atualizarProgresso, liberarResultados, montarProgresso } from './progresso'
import {
  abrirPaginaResultados,
  finalizarResultado,
} from './resultados'
import { salvarResultado } from '../storage/resultados'
import {
  criarControleMineracao,
  type ControleMineracao,
} from './controle-mineracao'
import { criarCicloMineracao } from './ciclo-mineracao'

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

/** A Meta pode apagar as datas da URL; a escolha da extensão vive na aba. */
function faixaAtual(): FaixaDias {
  const url = location.href
  return (
    lerFaixaPersistida(url, window.sessionStorage) ??
    lerFaixaDaUrl(url, new Date())
  )
}

/** O ritmo de fábrica. A config remota pode substituí-lo. */
let ritmo = { pisoMs: 2500, timeoutMs: 4500, jitter: 0.4 }

/** A sessão em curso. Um motor por `PedidoMineracao`; `Minerar novamente` troca os três. */
let motorAtual: Minerador | null = null
let controleAtual: ControleMineracao | null = null
let pedidoAtual: PedidoMineracao | null = null

const cicloMineracao = criarCicloMineracao(() => controleAtual)

document.addEventListener('visibilitychange', () => {
  cicloMineracao.aoMudarVisibilidade(document.visibilityState)
})
window.addEventListener('pagehide', () => {
  cicloMineracao.aoPagehide()
})

/** Monta o motor com os efeitos reais do navegador ligados. */
export function criarMinerador(
  storeAtual: AdStore,
  criterios: Criterios,
  limiteEncontrados: number,
  ritmoAtual: { pisoMs: number; timeoutMs: number; jitter: number },
  idsAvaliadosInicialmente: Iterable<string> = [],
): Minerador {
  return new Minerador({
    idsAvaliadosInicialmente,
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
      const cartao = cartaoAtual()
      if (cartao) atualizarProgresso(cartao, p, alvoAtual)
    },
  })
}

/** O cartão vive no shadow root dos enxertos; buscar sempre, nunca guardar. */
function cartaoAtual(): HTMLElement | null {
  return (
    plantio?.hospedeiro()?.shadowRoot?.querySelector<HTMLElement>(
      '[data-chave="progresso"]',
    ) ?? null
  )
}

/**
 * Devolve o motor da sessão: o atual, se ainda dá para retomar; senão um novo.
 *
 * O novo nasce com os IDs do store como já avaliados (spec, 2.3): a aba
 * continua indexando, mas a sessão nova conta só o que for inédito.
 */
export function iniciarMineracao(
  pedido: PedidoMineracao,
  storeAtual: AdStore = store,
): Minerador {
  const estado = motorAtual?.progresso().estado
  if (!motorAtual || (estado !== 'minerando' && estado !== 'pausado')) {
    const idsAvaliadosInicialmente = motorAtual
      ? storeAtual.todos().map((anuncio) => anuncio.id)
      : []
    motorAtual = criarMinerador(
      storeAtual,
      pedido.criterios,
      pedido.limiteEncontrados,
      ritmo,
      idsAvaliadosInicialmente,
    )
    controleAtual = criarControleMineracao({
      motor: motorAtual,
      origem: location.href,
      salvarParcial: salvarResultado,
    })
  }
  pedidoAtual = { ...pedido }
  return motorAtual
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
  observacao = observarGrade(document.body, agendarRepintura, 300)
}

/**
 * Ponto único de repintura: captura, observador da grade, SSR e a primeira
 * pintura da interface pedem por aqui, nunca chamando `repintar()` direto.
 * Assim várias solicitações seguidas — comuns quando a Meta troca dezenas de
 * nós de uma vez — viram uma repintura só, no próximo frame.
 */
const agendarRepintura = criarAgendadorRepintura(repintar, (callback) => {
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(callback)
  } else {
    window.setTimeout(callback, 0)
  }
})

/**
 * Pede a config ao service worker e aplica o que dela depende.
 *
 * Não bloqueia a subida: a extensão começa com o padrão de fábrica e troca
 * quando a resposta chegar. Esperar pela rede para pintar o primeiro card
 * seria trocar um risco raro por uma lentidão certa.
 */
function aplicarConfig(): Promise<void> {
  return new Promise((resolver) => {
    chrome.runtime.sendMessage({ tipo: 'obter-config' }, (config) => {
      if (!chrome.runtime.lastError && config?.anchors?.libraryIdPattern) {
        definirPadraoAncora(config.anchors.libraryIdPattern)
        // Sem este campo, a consulta forjada nem sai. É o interruptor remoto
        // do recurso: apagar o campo do arquivo hospedado o desliga em minutos.
        definirDocIdAnunciante(config.advertiserDocId)
        if (config.mining) ritmo = config.mining
      }
      resolver()
    })
  })
}

/** A config já aplicada — ou a ausência dela. A ponte de Instagram espera por isto. */
let configPronta: Promise<void> = Promise.resolve()

/**
 * O comando da página de resultados chega pelo canal privado da extensão,
 * nunca por `window.postMessage`: só o service worker fala aqui.
 */
chrome.runtime.onMessage.addListener((mensagem, _remetente, responder) => {
  if (mensagem?.tipo !== 'buscar-instagram') return false

  void atenderBuscaInstagram(mensagem, {
    aguardarConfig: () => configPronta,
    buscar: (pageId) =>
      buscarInstagram(pageId, {
        buscar: (...args) => fetch(...args),
        html: () => document.documentElement.innerHTML,
      }),
  }).then(responder)

  return true
})

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
      motorAtual?.avisarLote()
      agendarRepintura()
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

  // Na primeira vez substitui o botão; em `Minerar novamente`, o cartão velho.
  const alvo = shadow.querySelector<HTMLElement>(
    '[data-chave="minerar"], [data-chave="progresso"]',
  )
  if (!alvo) return null

  const cartao = montarProgresso(document, {
    aoAlternarPausa: () => {
      const controle = controleAtual
      if (!controle) return
      if (controle.estado() === 'pausado') {
        acompanharLaco(controle.retomar())
        // O motor só avisa ao fim de cada ciclo; o rótulo precisa virar agora.
        const atual = cartaoAtual()
        if (atual && motorAtual) atualizarProgresso(atual, motorAtual.progresso(), alvoAtual)
        return
      }
      void controle.pausar().then((salvo) => {
        const atual = cartaoAtual()
        if (salvo && atual) liberarResultados(atual)
      })
    },
    aoAbrirResultados: abrirPaginaResultados,
    aoParar: () => {
      void controleAtual?.interromper().then((salvo) => {
        const atual = cartaoAtual()
        if (salvo && atual) liberarResultados(atual)
        console.info(
          `[CopyHaunt] mineração interrompida; parcial ${salvo ? 'gravada' : 'não gravada'}`,
        )
      })
    },
    aoMinerarNovamente: () => {
      const cartao = cartaoAtual()
      if (!cartao || !pedidoAtual) return

      abrirGaveta(
        shadow,
        cartao,
        montarMinerar(
          document,
          location.href,
          new Date(),
          (pedido) => dispararMineracao(pedido, shadow),
          pedidoAtual,
        ),
      )
    },
    aoRecolher: () => {
      const botao = montarBotao(document, {
        chave: 'minerar',
        glifo: 'Minerar',
        icone: 'picareta',
        titulo: 'Minerar',
        variante: 'solido',
        aoClicar: () => {
          const atual = shadow.querySelector('[data-chave="minerar"]')
          if (atual) atual.replaceWith(cartao)
        },
      })
      const atual = shadow.querySelector('[data-chave="progresso"]')
      if (atual) atual.replaceWith(botao)
    },
  })
  cartao.dataset.chave = 'progresso'
  alvo.replaceWith(cartao)
  return cartao
}

/** Um enxerto por gaveta, mais o disparo. */
function montarEnxertos(): Enxerto[] {
  return [
    {
      chave: 'ajuda',
      glifo: '?',
      icone: 'interrogacao',
      somenteIcone: true,
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
      glifo: rotuloDaFaixa(faixaAtual()),
      icone: 'calendario',
      titulo: 'Tempo ativo',
      variante: 'contorno',
      aoClicar: (botao) => {
        const shadow = botao.getRootNode() as ShadowRoot
        alternarGaveta(shadow, botao, () =>
          montarCalendario(document, faixaAtual(), (f) => {
            salvarFaixaPersistida(location.href, f, window.sessionStorage)
            location.assign(montarUrlFiltro(location.href, f, new Date()))
          }),
        )
      },
    },
    {
      chave: 'minerar',
      glifo: 'Minerar',
      icone: 'picareta',
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
  mostrarProgresso(shadow)
  const motor = iniciarMineracao(pedido)
  acompanharLaco(motor.iniciar())
}

/**
 * Espera o laço terminar e fecha o resultado. Religado a cada início, inclusive
 * ao retomar: a Promise de `iniciar()` é de um laço só, e a pausa a resolve.
 *
 * O pós-filtro só roda quando o laço termina — a trava da seção 6.4. Pausa e
 * interrupção gravam parcial por outro caminho, sem pós-filtro.
 */
function acompanharLaco(laco: Promise<void>): void {
  const motor = motorAtual
  const pedido = pedidoAtual
  if (!motor || !pedido) return

  void laco.then(async () => {
    const p = motor.progresso()
    if (p.estado === 'pausado' || p.estado === 'interrompida') return

    const finais = await finalizarResultado(
      p,
      motor.encontrados(),
      location.href,
      {
        liberar: () => {
          const cartao = cartaoAtual()
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
 * existe. A interface (enxertos, observador, primeira repintura) não depende
 * do HTML da Meta — só do body existir — e sobe assim que ele nascer, sem
 * esperar `DOMContentLoaded`. Já o lote embutido no SSR só existe quando a
 * página termina de carregar, então essa leitura continua condicionada ao
 * evento.
 */
function iniciarInterface(): void {
  configPronta = aplicarConfig()
  plantio = plantarEnxertos(document, montarEnxertos())
  garantirObservador()
  agendarRepintura()
}

function iniciarSsr(): void {
  lerLoteInicial()
  agendarRepintura()
}

iniciarQuandoHouverBody(document, iniciarInterface)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarSsr, { once: true })
} else {
  iniciarSsr()
}

console.info('[CopyHaunt] content script ativo')
