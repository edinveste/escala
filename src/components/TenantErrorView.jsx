import { AlertCircle, RefreshCw } from 'lucide-react'

/**
 * TenantErrorView — Exibida em falhas críticas de configuração ou carregamento do tenant.
 */
export default function TenantErrorView({ tenantError, onRetry }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-900 text-gray-100">
      <div className="w-full max-w-md bg-surface-800 border border-red-500/30 rounded-3xl p-6 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-lg font-bold text-gray-100">Erro de Configuração</h2>
        <p className="text-xs text-gray-400">{tenantError}</p>
        <button
          onClick={onRetry}
          className="btn-primary py-2.5 px-4 text-xs flex items-center justify-center gap-2 mx-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Tentar Novamente
        </button>
      </div>
    </div>
  )
}

