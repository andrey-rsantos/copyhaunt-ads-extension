import { createMessage } from '../core/messages'
import { instalarConfirmacao } from './handshake'
import { aplicarPatch, ehEndpointDeAnuncios } from './xhr-patch'

/**
 * Roda no main world, em document_start — antes da primeira requisição da
 * página, senão o patch chega tarde.
 *
 * A coleta é passiva: nada aqui emite requisição. Só escuta o que a página
 * já pede sozinha.
 *
 * As mensagens vão para a própria origem, não para `*`: a página embute
 * iframes de terceiros, e não há motivo para transmitir o que capturamos
 * para todos eles.
 */
const DESTINO = window.location.origin

aplicarPatch(window.XMLHttpRequest as never, (captura) => {
  if (!ehEndpointDeAnuncios(captura.url)) return
  window.postMessage(createMessage('raw-capture', captura), DESTINO)
})

instalarConfirmacao(
  (listener) => window.addEventListener('message', listener),
  () => window.postMessage(createMessage('interceptor-ready', {}), DESTINO),
  window,
)
console.info('[CopyHaunt] interceptador ativo no main world')
