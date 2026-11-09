import { Building2, LogOut } from 'lucide-react'

/**
 * PortalSemEmpresaView — Exibida quando um gestor se autentica no Portal de Gestão
 * (app.escalafacil.online), porém ainda não possui vínculo de gestão com nenhuma empresa.
 */
export default function PortalSemEmpresaView({ userEmail, onSignOut }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-900 text-gray-100">
      <div className="w-full max-w-md bg-surface-800 border border-surface-700 rounded-3xl p-6 sm:p-8 text-center space-y-5 animate-scale-in">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
          <Building2 className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-100">Nenhuma Empresa Vinculada</h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-2">
            Sua conta ({userEmail}) ainda não possui vínculo de gestão com nenhuma empresa cadastrada.
          </p>
        </div>
        <p className="text-xs text-gray-500">
          Solicite ao administrador para adicionar seu e-mail como gestor no painel de administração.
        </p>
        <button
          onClick={onSignOut}
          className="w-full btn-secondary py-2.5 text-xs flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Desconectar da Conta
        </button>
      </div>
    </div>
  )
}

