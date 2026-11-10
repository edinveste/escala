import { useState } from 'react'
import { UserPlus, Mail, Sparkles } from 'lucide-react'

/**
 * Formulário para convite e vinculação de novos administradores ou coordenadores.
 */
export default function FormAddGestor({
  onVincular,
  loading = false,
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('gestor') // 'gestor' | 'admin'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || loading) return

    const sucesso = await onVincular({ email: email.trim(), role })
    if (sucesso) {
      setEmail('')
      setRole('gestor')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 sm:p-4 rounded-2xl bg-surface-900/60 border border-surface-700/80 space-y-3"
    >
      <p className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
        <UserPlus className="w-3.5 h-3.5 text-brand-400" />
        Adicionar Novo Gestor ou Coordenador
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-medium text-gray-400 mb-1">
            E-mail do Usuário
          </label>
          <div className="relative">
            <Mail className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="gestor@empresa.com"
              className="input-field w-full text-xs py-2 pl-9 pr-3"
              disabled={loading}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1">
            Nível de Acesso (Papel)
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={loading}
            className="input-field w-full text-xs py-2 px-3 appearance-none cursor-pointer"
          >
            <option value="gestor">Coordenador (Gestão de Vagas)</option>
            <option value="admin">Administrador (Acesso Total)</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
        <p className="text-[11px] text-gray-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-brand-400 flex-shrink-0" />
          Se o gestor ainda não tiver conta, o acesso será ativado automaticamente assim que ele se cadastrar.
        </p>

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="btn-primary text-xs py-2 px-4 flex items-center justify-center gap-1.5 self-end sm:self-auto whitespace-nowrap shadow-md shadow-brand-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Vinculando...</span>
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" />
              <span>Vincular Gestor</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}

