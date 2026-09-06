import { createMessage } from '../core/messages'

/**
 * Roda no main world, em document_start. Nesta fase apenas anuncia
 * presença — o patch em XMLHttpRequest entra num plano posterior.
 */
window.postMessage(createMessage('interceptor-ready', {}), '*')
console.info('[CopyHaunt] interceptador ativo no main world')
