import type { Relogio } from './clock'
import { avaliar, type Criterios } from './criteria'
import type { AdStore } from './store'
import type { Ad } from './types'

export type EstadoMineracao =
  | 'parado'
  | 'minerando'
  | 'pausado'
  | 'interrompida'
  | 'concluido'
  | 'esgotado'
  | 'incompreensivel'
  | 'limite-seguranca'

export interface Progresso {
  estado: EstadoMineracao
  analisados: number
  encontrados: number
  rolagens: number
}

export interface OpcoesMineracao {
  store: AdStore
  criterios: Criterios
  relogio: Relogio
  /** Efeito injetado: rolar a página. Nos testes, um espião. */
  rolar: () => void
  /**
   * Espera mínima entre uma rolagem e a seguinte, mesmo que o lote chegue
   * antes. Medido: a Meta responde a cada ~3,0 s, e 2,5 s fica abaixo disso
   * sem atropelar.
   */
  pisoMs: number
  /**
   * Quanto esperar pelo lote antes de desistir e rolar assim mesmo. Medido:
   * o intervalo máximo observado foi 4,5 s.
   */
  timeoutMs: number
  /**
   * Margem de variação da espera, de 0 a 1. Cadência rígida é o sinal mais
   * óbvio de automação; 0,4 espalha a espera em ±40%.
   */
  jitter: number
  /** Fonte de aleatoriedade, injetada para o jitter ser testável. */
  aleatorio?: () => number
  maxRolagens: number
  limiteEncontrados: number
  /** Altura do documento. Cresce quando a Meta entrega mais anúncios. */
  alturaDaPagina: () => number
  /** Quantos cards a Meta renderizou no DOM atual. */
  cardsNaTela: () => number
  aoProgredir?: (p: Progresso) => void
  /**
   * Fronteira de uma sessão nova: IDs que já passaram pelo crivo em sessões
   * anteriores desta aba e não devem ser recontados.
   */
  idsAvaliadosInicialmente?: Iterable<string>
}

/** Estados dos quais o motor não sai por conta própria. */
const TERMINAIS: ReadonlySet<EstadoMineracao> = new Set([
  'interrompida',
  'concluido',
  'esgotado',
  'incompreensivel',
  'limite-seguranca',
])

/**
 * Conduz a mineração: rola, deixa a página pedir mais, e avalia o que
 * chegou ao store.
 *
 * **Não emite requisição nenhuma.** A coleta continua passiva: quem pede é a
 * página, e nós só reagimos ao que o interceptador capturou. A seção 2 do
 * spec proíbe explicitamente requisição no motor de mineração.
 */
export class Minerador {
  private estado: EstadoMineracao = 'parado'
  private rolagens = 0
  /** Só os desta sessão: a fronteira herdada não conta como trabalho feito. */
  private analisados = 0
  private readonly avaliados: Set<string>
  private readonly aprovados: Ad[] = []
  private laco: Promise<void> | null = null
  private avisarPendente: (() => void) | null = null
  private voltasVazias = 0
  private alturaAnterior = 0

  constructor(private readonly opcoes: OpcoesMineracao) {
    const limite = opcoes.limiteEncontrados
    if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
      throw new RangeError('limiteEncontrados deve ser um inteiro entre 1 e 100')
    }
    this.avaliados = new Set(opcoes.idsAvaliadosInicialmente ?? [])
  }

  progresso(): Progresso {
    return {
      estado: this.estado,
      analisados: this.analisados,
      encontrados: this.aprovados.length,
      rolagens: this.rolagens,
    }
  }

  encontrados(): Ad[] {
    return [...this.aprovados]
  }

  parar(): void {
    if (this.estado !== 'minerando') return
    this.estado = 'pausado'
    this.soltarEspera()
    this.opcoes.aoProgredir?.(this.progresso())
  }

  /** Fim definitivo: diferente de `parar`, daqui não se retoma. */
  interromper(): void {
    if (this.estado !== 'minerando' && this.estado !== 'pausado') return
    this.estado = 'interrompida'
    this.soltarEspera()
    this.opcoes.aoProgredir?.(this.progresso())
  }

  /** Acorda o laço preso na espera pelo lote, para ele ver o estado novo. */
  private soltarEspera(): void {
    const avisar = this.avisarPendente
    this.avisarPendente = null
    if (avisar) avisar()
  }

  /**
   * O content script chama isto quando um lote inédito entra no store.
   *
   * É o que torna o laço reativo: em vez de rolar por cronômetro, ele espera
   * a Meta responder. Medido no laço antigo: 162 rolagens para 83 lotes,
   * quase metade sem trazer nada.
   */
  avisarLote(): void {
    this.soltarEspera()
  }

  /** Chamar duas vezes devolve o mesmo laço, não abre um segundo. */
  iniciar(): Promise<void> {
    if (this.laco) return this.laco
    if (TERMINAIS.has(this.estado)) return Promise.resolve()
    this.estado = 'minerando'
    this.voltasVazias = 0
    this.alturaAnterior = this.opcoes.alturaDaPagina()
    this.laco = this.rodar().finally(() => {
      this.laco = null
    })
    return this.laco
  }

  private async rodar(): Promise<void> {
    const o = this.opcoes

    while (this.estado === 'minerando') {
      await o.relogio.esperar(this.esperaComJitter())
      if (this.estado !== 'minerando') break

      o.rolar()
      this.rolagens += 1

      const veioLote = await this.esperarLote()
      if (this.estado !== 'minerando') break

      this.avaliarNovos()
      o.aoProgredir?.(this.progresso())

      const altura = o.alturaDaPagina()
      const cresceu = altura > this.alturaAnterior
      this.alturaAnterior = altura

      if (!veioLote && !cresceu) this.voltasVazias += 1
      else this.voltasVazias = 0

      const paginaIncompreensivel = o.cardsNaTela() > 0 && o.store.total() === 0
      if (this.voltasVazias >= 3 && paginaIncompreensivel) {
        this.estado = 'incompreensivel'
        o.aoProgredir?.(this.progresso())
        break
      }

      const limiteEsgotado = o.store.total() === 0 ? 2 : 5
      if (this.voltasVazias >= limiteEsgotado && !paginaIncompreensivel) {
        this.estado = 'esgotado'
        o.aoProgredir?.(this.progresso())
        break
      }

      if (this.aprovados.length >= o.limiteEncontrados) {
        this.estado = 'concluido'
        o.aoProgredir?.(this.progresso())
        break
      }
      if (this.rolagens >= o.maxRolagens) {
        this.estado = 'limite-seguranca'
        o.aoProgredir?.(this.progresso())
        break
      }
    }
  }

  /** O piso, espalhado pelo jitter. */
  private esperaComJitter(): number {
    const o = this.opcoes
    if (o.jitter <= 0) return o.pisoMs
    const sorte = (o.aleatorio ?? Math.random)()
    // sorte 0 → -jitter; sorte 1 → +jitter
    return Math.round(o.pisoMs * (1 + o.jitter * (sorte * 2 - 1)))
  }

  /**
   * Espera o lote chegar, ou o timeout estourar. Devolve `true` se veio lote.
   *
   * A corrida entre as duas promessas é o coração do laço reativo: a Meta
   * lenta nos desacelera sozinha, sem regra nova.
   */
  private async esperarLote(): Promise<boolean> {
    const o = this.opcoes
    let chegou = false
    const aviso = new Promise<void>((liberar) => {
      this.avisarPendente = () => { chegou = true; liberar() }
    })
    await Promise.race([aviso, o.relogio.esperar(o.timeoutMs)])
    this.avisarPendente = null
    return chegou
  }

  /** Só o que ainda não passou pelo crivo, para não recontar a cada ciclo. */
  private avaliarNovos(): void {
    const o = this.opcoes
    const agora = o.relogio.agora()

    for (const ad of o.store.todos()) {
      if (this.aprovados.length >= o.limiteEncontrados) break
      if (this.avaliados.has(ad.id)) continue
      this.avaliados.add(ad.id)
      this.analisados += 1

      const veredito = avaliar(ad, o.criterios, {
        presenca: o.store.presenca(ad.anunciante.pageId),
        colacao: o.store.colacaoDe(ad),
        agora,
      })
      if (veredito.passa) this.aprovados.push(ad)
    }
  }
}
