import { isCopyHauntMessage } from '../core/messages'

type Observar = (listener: (evento: MessageEvent) => void) => void

export function instalarConfirmacao(
  observar: Observar,
  postar: () => void,
  proprio: unknown,
): void {
  observar((evento) => {
    if (evento.source !== proprio) return
    if (!isCopyHauntMessage(evento.data)) return
    if (evento.data.kind === 'content-ready') postar()
  })
  postar()
}
