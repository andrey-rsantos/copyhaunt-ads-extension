/**
 * O motor recebe o relógio por parâmetro.
 *
 * Em produção ele é cravado em Web Worker, porque o Chrome estrangula
 * `setTimeout` em aba não focada e a mineração morreria assim que o usuário
 * trocasse de janela.
 *
 * Nos testes entra um relógio falso que avança na hora. Sem essa injeção, o
 * motor só rodaria com navegador aberto — e um motor que ninguém testa é um
 * motor que ninguém conserta.
 */
export interface Relogio {
  agora(): Date
  esperar(ms: number): Promise<void>
}

interface Pendente {
  quando: number
  liberar: () => void
}

export function relogioDeTeste(
  inicio: Date,
): Relogio & { avancar(ms: number): Promise<void> } {
  let t = inicio.getTime()
  let pendentes: Pendente[] = []

  return {
    agora: () => new Date(t),
    esperar: (ms) =>
      new Promise<void>((liberar) => {
        pendentes.push({ quando: t + ms, liberar })
      }),
    avancar: async (ms) => {
      t += ms
      const vencidos = pendentes
        .filter((p) => p.quando <= t)
        .sort((a, b) => a.quando - b.quando)
      pendentes = pendentes.filter((p) => p.quando > t)
      for (const p of vencidos) {
        p.liberar()
        // Deixa a microtask do consumidor rodar antes da próxima.
        await Promise.resolve()
      }
    },
  }
}

/**
 * Relógio de produção: os tiques vêm de um Web Worker, imune ao
 * estrangulamento de timer em aba de segundo plano.
 *
 * O worker é criado a partir de um blob para não exigir arquivo separado no
 * empacotamento da extensão.
 */
export function relogioDeWorker(): Relogio {
  const fonte = `
    self.onmessage = (e) => {
      setTimeout(() => self.postMessage(e.data), e.data.ms)
    }
  `
  const worker = new Worker(
    URL.createObjectURL(new Blob([fonte], { type: 'text/javascript' })),
  )
  let proximo = 0
  const pendentes = new Map<number, () => void>()

  worker.onmessage = (e: MessageEvent<{ id: number }>) => {
    const liberar = pendentes.get(e.data.id)
    if (liberar) {
      pendentes.delete(e.data.id)
      liberar()
    }
  }

  return {
    agora: () => new Date(),
    esperar: (ms) =>
      new Promise<void>((liberar) => {
        const id = (proximo += 1)
        pendentes.set(id, liberar)
        worker.postMessage({ id, ms })
      }),
  }
}
