/**
 * Consolida solicitações de repintura num agendador único.
 *
 * Captura, observador da grade e SSR pediam repintura completa várias vezes
 * seguidas — cada uma bastava sozinha, mas juntas repintavam a mesma grade
 * de novo sem nenhuma mudar o resultado. O agendador junta tudo num só
 * `repintar()` por frame: a primeira chamada agenda o frame, as seguintes
 * são descartadas até ele rodar, e uma solicitação feita durante a própria
 * repintura já agenda o próximo frame.
 *
 * Puro: não acessa `window`, `document` nem timers — quem chama decide o que
 * é "o próximo frame" através de `solicitarFrame`.
 */
export function criarAgendadorRepintura(
  repintar: () => void,
  solicitarFrame: (callback: () => void) => void,
): () => void {
  let pendente = false

  return () => {
    if (pendente) return
    pendente = true
    solicitarFrame(() => {
      pendente = false
      repintar()
    })
  }
}
