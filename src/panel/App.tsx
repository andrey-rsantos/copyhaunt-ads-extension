import { useState } from 'react'
import { PRESETS } from '../core/dateFilter'
import { DIAS_MAX } from '../core/filtro'
import { createMessage } from '../core/messages'

/** Um lado da faixa: número válido, ou null quando vazio. */
function lado(valor: string): number | null {
  const n = Number(valor)
  if (valor.trim() === '') return null
  return Number.isInteger(n) && n >= 1 && n <= DIAS_MAX ? n : null
}

export function App() {
  const [min, setMin] = useState('7')
  const [max, setMax] = useState('')

  const diasMin = lado(min)
  const diasMax = lado(max)
  const vazio = min.trim() === '' && max.trim() === ''
  const invertido = diasMin !== null && diasMax !== null && diasMin > diasMax
  const podeEnviar = !vazio && !invertido

  function aplicar(): void {
    window.parent.postMessage(
      createMessage('panel-command', { diasMin, diasMax }),
      '*',
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 bg-charcoal p-4 font-sans text-white">
      <h1 className="font-display text-lg font-bold">
        Copy<span className="text-purple">Haunt</span>
      </h1>

      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={DIAS_MAX}
          value={min}
          onChange={(e) => setMin(e.target.value)}
          placeholder="mín"
          aria-label="mínimo de dias no ar"
          className="w-20 rounded-btn bg-ink px-2 py-1 text-xs text-white"
        />
        <span className="text-xs text-muted">até</span>
        <input
          type="number"
          min={1}
          max={DIAS_MAX}
          value={max}
          onChange={(e) => setMax(e.target.value)}
          placeholder="máx"
          aria-label="máximo de dias no ar"
          className="w-20 rounded-btn bg-ink px-2 py-1 text-xs text-white"
        />
        <span className="text-xs text-muted">dias no ar</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setMin(String(d))}
            className="rounded-btn bg-ink px-2 py-1 text-xs text-lavender"
          >
            {d}+
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={aplicar}
        disabled={!podeEnviar}
        className="rounded-btn bg-purple px-2 py-1 text-xs text-white disabled:opacity-40"
      >
        Aplicar
      </button>
    </div>
  )
}
