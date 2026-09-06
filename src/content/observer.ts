/**
 * A Meta recicla os cards durante a rolagem: nós são destruídos e recriados,
 * e as bandejas plantadas vão junto. Medido — depois de três rolagens, zero
 * bandejas sobreviviam.
 *
 * Este observador replanta. Ele fica no container da grade, não no
 * documento inteiro, e agrupa as mudanças num único disparo: a Meta muda o
 * DOM dezenas de vezes por rolagem, e repintar a cada mutação seria repintar
 * durante a própria repintura.
 */
export interface Observacao {
  parar(): void
}

export function observarGrade(
  alvo: Node,
  aoMudar: () => void,
  esperaMs = 250,
): Observacao {
  let agendado: ReturnType<typeof setTimeout> | null = null

  const disparar = () => {
    if (agendado !== null) clearTimeout(agendado)
    agendado = setTimeout(() => {
      agendado = null
      aoMudar()
    }, esperaMs)
  }

  const observador = new MutationObserver(disparar)
  observador.observe(alvo, {
    childList: true,
    subtree: true,
    // Atributos e texto não interessam: só a chegada e a saída de cards.
    attributes: false,
    characterData: false,
  })

  return {
    parar() {
      if (agendado !== null) clearTimeout(agendado)
      observador.disconnect()
    },
  }
}
