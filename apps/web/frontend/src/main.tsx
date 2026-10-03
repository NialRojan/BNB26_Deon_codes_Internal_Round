import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { VaultProvider } from './lib/vault'
import { B2B2CProvider } from './lib/b2b2cStore'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <B2B2CProvider>
        <VaultProvider>
          <App />
        </VaultProvider>
      </B2B2CProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
