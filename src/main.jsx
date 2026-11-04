import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ConfirmProvider } from './components/ConfirmModal.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { TenantProvider } from './contexts/TenantContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfirmProvider>
      <AuthProvider>
        <TenantProvider>
          <App />
        </TenantProvider>
      </AuthProvider>
    </ConfirmProvider>
  </React.StrictMode>,
)
