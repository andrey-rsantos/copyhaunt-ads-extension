import { useState } from 'react'
import { PRESETS } from '../core/dateFilter'
import { createMessage } from '../core/messages'

export function App() {
  const [selecionado, setSelecionado] = useState<number | null>(null)

  function aplicar(): void {
    window.parent.postMessage(
      createMessage('panel-command', {
        diasMin: selecionado,
        diasMax: null,
      }),
      '*',
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 bg-charcoal p-4 font-sans text-white">
      <h1 className="font-display text-lg font-bold">
        Copy<span className="text-purple">Haunt</span>
      </h1>

      <p className="text-xs text-muted">Anúncios no ar há pelo menos:</p>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          aria-pressed={selecionado === null}
          onClick={() => setSelecionado(null)}
          className="rounded-btn bg-ink px-2 py-1 text-xs text-lavender"
        >
          Sem filtro
        </button>
        {PRESETS.map((dias) => (
          <button
            key={dias}
            type="button"
            aria-pressed={selecionado === dias}
            onClick={() => setSelecionado(dias)}
            className="rounded-btn bg-ink px-2 py-1 text-xs text-lavender"
          >
            {dias}+ Dias
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={aplicar}
        className="rounded-btn bg-purple px-2 py-1 text-xs text-white"
      >
        Aplicar
      </button>
    </div>
  )
}
