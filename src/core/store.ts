import type { Ad } from './types'

/**
 * Índice em memória dos anúncios vistos na sessão.
 *
 * A presença por anunciante é contada aqui, incrementalmente: é o critério de
 * escala da seção 7 do spec, e sai de graça porque o `pageId` já vem em cada
 * anúncio. Nenhuma requisição é feita para obtê-la.
 */
export class AdStore {
  private readonly porId = new Map<string, Ad>()
  private readonly porAnunciante = new Map<string, number>()
  private readonly porGrupo = new Map<string, { membros: number; maxima: number }>()

  adicionar(ads: Ad[]): void {
    for (const ad of ads) {
      if (this.porId.has(ad.id)) continue
      this.porId.set(ad.id, ad)
      const pageId = ad.anunciante.pageId
      this.porAnunciante.set(pageId, (this.porAnunciante.get(pageId) ?? 0) + 1)
      if (ad.colacaoId) {
        const grupo = this.porGrupo.get(ad.colacaoId)
        this.porGrupo.set(ad.colacaoId, {
          membros: (grupo?.membros ?? 0) + 1,
          maxima: Math.max(grupo?.maxima ?? 1, ad.colacao),
        })
      }
    }
  }

  obter(id: string): Ad | undefined {
    return this.porId.get(id)
  }

  /** Quantos anúncios deste anunciante apareceram nesta busca. */
  presenca(pageId: string): number {
    return this.porAnunciante.get(pageId) ?? 0
  }

  /**
   * Quantos anúncios usam o mesmo criativo.
   *
   * A Meta grava `collation_count` apenas no líder do grupo; os demais membros
   * vêm com `null` e o mesmo `collation_id`. Contar os membros vistos recupera
   * esses casos — e entrega algo melhor que o número dela quando o grupo
   * inteiro apareceu na busca: conta o que de fato está nesta pesquisa.
   */
  colacaoDe(ad: Ad): number {
    const grupo = ad.colacaoId ? this.porGrupo.get(ad.colacaoId) : undefined
    return Math.max(ad.colacao, grupo?.membros ?? 0, grupo?.maxima ?? 0)
  }

  total(): number {
    return this.porId.size
  }

  todos(): Ad[] {
    return [...this.porId.values()]
  }

  limpar(): void {
    this.porId.clear()
    this.porAnunciante.clear()
    this.porGrupo.clear()
  }
}
