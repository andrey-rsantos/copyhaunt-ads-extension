import type { Relogio } from './clock'
import { avaliar, type Criterios } from './criteria'
import type { AdStore } from './store'
import type { Ad } from './types'

export type EstadoMineracao =
  | 'parado'
  | 'minerando'
  | 'pausado'
  | 'concluido'

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
  aoProgredir?: (p: Progresso) => void
}

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
  private readonly avaliados = new Set<string>()
  private readonly aprovados: Ad[] = []
  private laco: Promise<void> | null = null
  private avisarPendente: (() => void) | null = null

  constructor(private readonly opcoes: OpcoesMineracao) {}

  progresso(): Progresso {
    return {
      estado: this.estado,
      analisados: this.avaliados.size,
      encontrados: this.aprovados.length,
      rolagens: this.rolagens,
    }
  }

  encontrados(): Ad[] {
    return [...this.aprovados]
  }

  parar(): void {
    if (this.estado === 'minerando') this.estado = 'pausado'
  }

  /**
   * O content script chama isto quando um lote inédito entra no store.
   *
   * É o que torna o laço reativo: em vez de rolar por cronômetro, ele espera
   * a Meta responder. Medido no laço antigo: 162 rolagens para 83 lotes,
   * quase metade sem trazer nada.
   */
  avisarLote(): void {
    const avisar = this.avisarPendente
    this.avisarPendente = null
    if (avisar) avisar()
  }

  /** Chamar duas vezes devolve o mesmo laço, não abre um segundo. */
  iniciar(): Promise<void> {
    if (this.laco) return this.laco
    this.estado = 'minerando'
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

      await this.esperarLote()
      if (this.estado !== 'minerando') break

      this.avaliarNovos()
      o.aoProgredir?.(this.progresso())

      if (this.aprovados.length >= o.limiteEncontrados) {
        this.estado = 'concluido'
        break
      }
      if (this.rolagens >= o.maxRolagens) {
        this.estado = 'concluido'
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
      if (this.avaliados.has(ad.id)) continue
      this.avaliados.add(ad.id)

      const veredito = avaliar(ad, o.criterios, {
        presenca: o.store.presenca(ad.anunciante.pageId),
        colacao: o.store.colacaoDe(ad),
        agora,
      })
      if (veredito.passa) this.aprovados.push(ad)
    }
  }
}
