import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import '../styles/tokens.css'

const root = document.getElementById('root')
if (!root) throw new Error('elemento #root não encontrado no painel')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
