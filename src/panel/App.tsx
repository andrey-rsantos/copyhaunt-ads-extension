import { useState } from 'react'
import { PRESETS, type ModoFiltro } from '../core/dateFilter'
import { DIAS_MAX } from '../core/filtro'
import { createMessage } from '../core/messages'

/** Rótulo curto: até uma semana em dias, daí em diante em semanas. */
function rotulo(dias: number): string {
  return dias < 7 ? `${dias} dias` : `${dias / 7} sem`
}

const MODOS: { chave: ModoFiltro; nome: string; ajuda: string }[] = [
  { chave: 'provadas', nome: 'Provadas', ajuda: 'no ar há pelo menos X' },
  { chave: 'subindo', nome: 'Subindo', ajuda: 'no ar há no máximo X' },
]

export function App() {
  const [modo, setModo] = useState<ModoFiltro>('provadas')
  const [personalizado, setPersonalizado] = useState('')

  function filtrar(dias: number): void {
    window.parent.postMessage(createMessage('panel-command', { modo, dias }), '*')
  }

  const dias = Number(personalizado)
  const podeEnviar = Number.isInteger(dias) && dias >= 1 && dias <= DIAS_MAX

  return (
    <div className="flex h-full flex-col gap-3 bg-charcoal p-4 font-sans text-white">
      <h1 className="font-display text-lg font-bold">
        Copy<span className="text-purple">Haunt</span>
      </h1>

      <div className="flex gap-2">
        {MODOS.map((m) => (
          <button
            key={m.chave}
            type="button"
            title={m.ajuda}
            onClick={() => setModo(m.chave)}
            className={`flex-1 rounded-btn px-2 py-1 text-sm ${
              modo === m.chave ? 'bg-purple text-white' : 'bg-ink text-muted'
            }`}
          >
            {m.nome}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => filtrar(d)}
            className="rounded-btn bg-ink px-2 py-1 text-xs text-lavender"
          >
            {rotulo(d)}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (podeEnviar) filtrar(dias)
        }}
      >
        <input
          type="number"
          min={1}
          max={DIAS_MAX}
          value={personalizado}
          onChange={(e) => setPersonalizado(e.target.value)}
          placeholder="dias"
          aria-label="dias"
          className="w-20 rounded-btn bg-ink px-2 py-1 text-xs text-white"
        />
        <button
          type="submit"
          disabled={!podeEnviar}
          className="rounded-btn bg-ink px-2 py-1 text-xs text-lavender disabled:opacity-40"
        >
          Aplicar
        </button>
      </form>
    </div>
  )
}
