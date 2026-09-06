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

  adicionar(ads: Ad[]): void {
    for (const ad of ads) {
      if (this.porId.has(ad.id)) continue
      this.porId.set(ad.id, ad)
      const pageId = ad.anunciante.pageId
      this.porAnunciante.set(pageId, (this.porAnunciante.get(pageId) ?? 0) + 1)
    }
  }

  obter(id: string): Ad | undefined {
    return this.porId.get(id)
  }

  /** Quantos anúncios deste anunciante apareceram nesta busca. */
  presenca(pageId: string): number {
    return this.porAnunciante.get(pageId) ?? 0
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
  }
}
