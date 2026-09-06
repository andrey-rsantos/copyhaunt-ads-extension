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
  intervaloMs: number
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
      await o.relogio.esperar(o.intervaloMs)
      if (this.estado !== 'minerando') break

      o.rolar()
      this.rolagens += 1

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

  /** Só o que ainda não passou pelo crivo, para não recontar a cada ciclo. */
  private avaliarNovos(): void {
    const o = this.opcoes
    const agora = o.relogio.agora()

    for (const ad of o.store.todos()) {
      if (this.avaliados.has(ad.id)) continue
      this.avaliados.add(ad.id)

      const veredito = avaliar(ad, o.criterios, {
        presenca: o.store.presenca(ad.anunciante.pageId),
        agora,
      })
      if (veredito.passa) this.aprovados.push(ad)
    }
  }
}
