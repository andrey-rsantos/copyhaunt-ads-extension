import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/tokens.css'
import './resultados.css'
import { App } from './App'

const raiz = document.querySelector('#root')
if (!raiz) throw new Error('A página de resultados precisa de #root')

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
