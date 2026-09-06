import { useEffect } from 'react'
import { createMessage } from '../core/messages'

export function App() {
  useEffect(() => {
    window.parent.postMessage(createMessage('panel-ready', {}), '*')
  }, [])

  return (
    <div className="flex h-full flex-col gap-2 bg-charcoal p-4 font-sans text-white">
      <h1 className="font-display text-lg font-bold">
        Copy<span className="text-purple">Haunt</span>
      </h1>
      <p className="text-sm text-muted">Painel pronto. Nada minerando ainda.</p>
    </div>
  )
}
