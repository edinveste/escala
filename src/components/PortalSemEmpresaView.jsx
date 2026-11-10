import { useState } from 'react'
import { Building2, Plus, LogOut, ArrowRight, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useTenant } from '../contexts/TenantContext'

/**
 * PortalSemEmpresaView — Exibida quando um gestor se autentica no Portal de Gestão
 * (app.escalafacil.online), porém ainda não possui vínculo de gestão com nenhuma empresa.
 * Permite que ele crie a sua própria imobiliária/empresa instantaneamente (Self-Service Onboarding).
 */
export default function PortalSemEmpresaView({ userEmail, onSignOut }) {
  const { refreshAuth } = useAuth()
  const { refreshEmpresa, switchTenant } = useTenant()

  const [mostrarCriacao, setMostrarCriacao] = useState(false)
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState('')

  const handleCriarEmpresa = async (e) => {
    if (e) e.preventDefault()
    setErro('')

    const nomeLimpo = nomeEmpresa.trim()
    if (!nomeLimpo || nomeLimpo.length < 2) {
      setErro('Informe um nome válido com pelo menos 2 caracteres.')
      return
    }

    setCriando(true)
    try {
      const { data, error } = await supabase.rpc('criar_nova_empresa', {
        p_nome: nomeLimpo,
      })

      if (error) throw error

      if (refreshAuth) await refreshAuth()
      if (data?.empresa_id || data?.id) {
        if (switchTenant) switchTenant(data.empresa_id || data.id)
      }
      if (refreshEmpresa) await refreshEmpresa()
    } catch (err) {
      console.error('Erro ao provisionar empresa:', err)
      setErro(err.message || 'Falha ao criar empresa. Tente novamente.')
    } finally {
      setCriando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-900 text-gray-100">
      <div className="w-full max-w-md bg-surface-800 border border-surface-700 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl animate-scale-in">
        {/* Ícone de Destaque */}
        <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
          <Building2 className="w-7 h-7" />
        </div>

        {/* Cabeçalho */}
        <div className="text-center space-y-1.5">
          <h2 className="text-xl font-bold text-gray-100">
            {mostrarCriacao ? 'Criar Sua Empresa' : 'Nenhuma Empresa Vinculada'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-400">
            Sua conta <span className="text-gray-200 font-semibold">{userEmail}</span> está pronta para uso.
          </p>
        </div>

        {/* Mensagem de Erro */}
        {erro && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            {erro}
          </div>
        )}

        {/* Formulário de Criação Rápida de Empresa */}
        {mostrarCriacao ? (
          <form onSubmit={handleCriarEmpresa} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold text-gray-300 block">
                Nome da Imobiliária / Empresa
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={nomeEmpresa}
                  onChange={(e) => setNomeEmpresa(e.target.value)}
                  placeholder="Ex: Prime Imóveis, Direcional"
                  autoFocus
                  required
                  disabled={criando}
                  className="input-field pl-10 text-sm"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                Você será configurado automaticamente como Administrador Geral.
              </p>
            </div>

            <button
              type="submit"
              disabled={criando}
              className="w-full btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {criando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Provisionando ambiente...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Criar e Entrar no Painel</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMostrarCriacao(false)
                setErro('')
              }}
              disabled={criando}
              className="w-full text-xs text-gray-400 hover:text-gray-200 py-1 transition-colors"
            >
              Voltar
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 leading-relaxed text-center">
              Você ainda não gerencia nenhuma escala. Você pode criar uma nova imobiliária agora ou solicitar a um administrador para vincular seu e-mail.
            </p>

            <button
              type="button"
              onClick={() => setMostrarCriacao(true)}
              className="w-full btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Minha Empresa Agora</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="w-full btn-secondary py-2.5 text-xs flex items-center justify-center gap-2 mt-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Desconectar da Conta</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
