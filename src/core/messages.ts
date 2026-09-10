/**
 * Contrato de mensagens entre os quatro contextos de execução.
 *
 * O main world é território compartilhado: qualquer script da página, ou de
 * outra extensão, também posta mensagens ali. Por isso toda mensagem nossa
 * é carimbada com um namespace e verificada na chegada.
 */
export const NAMESPACE = 'copyhaunt'

export type MessageKind =
  | 'interceptor-ready'
  | 'content-ready'
  | 'raw-capture'
  | 'panel-ready'
  | 'panel-command'

export interface CopyHauntMessage<P = unknown> {
  namespace: typeof NAMESPACE
  kind: MessageKind
  payload: P
}

export function createMessage<P>(
  kind: MessageKind,
  payload: P,
): CopyHauntMessage<P> {
  return { namespace: NAMESPACE, kind, payload }
}

export function isCopyHauntMessage(
  value: unknown,
): value is CopyHauntMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as CopyHauntMessage).namespace === NAMESPACE
  )
}
