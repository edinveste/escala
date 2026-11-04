import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabaseClient'
import { useTenant } from '../contexts/TenantContext'
import { useAuth } from '../contexts/AuthContext'
import { getTenantShareUrl } from '../lib/tenantHelper'
import {
  Building2,
  X,
  Copy,
  Check,
  Plus,
  Share2,
  ExternalLink,
  Shield,
  Layers,
} from 'lucide-react'

export default function TenantSwitcherModal({ isOpen, onClose, showToast }) {
  const { empresa, switchTenant, setShowNovaEmpresaModal } = useTenant()
  const { isSuperadmin } = useAuth()
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    setLoading(true)
    supabase
      .from('empresas')
      .select('id, nome, slug, status, plano, created_at')
      .order('nome', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setEmpresas(data)
        }
      })
      .finally(() => setLoading(false))

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const shareUrl = getTenantShareUrl(empresa?.slug)

  const handleCopiarLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopiado(true)
      showToast('Link da escala copiado! Envie no WhatsApp da equipe 📋', 'success')
      setTimeout(() => setCopiado(false), 2500)
    } catch (err) {
      console.error('Erro ao copiar link:', err)
      showToast('Erro ao copiar link.', 'error')
    }
  }

  const handleSelecionarEmpresa = (novoSlug) => {
    if (novoSlug !== empresa?.slug) {
      switchTenant(novoSlug)
      showToast(`Ambiente alterado para "${novoSlug}"!`, 'info')
    }
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-surface-800 border border-surface-600 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl animate-scale-in z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-100">
                Imobiliária Ativa
              </h3>
              <p className="text-xs text-gray-400">
                Gerencie ou alterne entre seus clientes SaaS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card da Empresa Atual */}
        {empresa && (
          <div className="p-3.5 rounded-xl bg-surface-900/80 border border-brand-500/30 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                  Ambiente Atual
                </span>
                <h4 className="text-sm font-bold text-gray-100 truncate">
                  {empresa.nome}
                </h4>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {empresa.status === 'ativo' ? 'Ativo' : empresa.status}
              </span>
            </div>

            {/* Link direto para corretores */}
            <div className="space-y-1.5 pt-1 border-t border-surface-700/60">
              <label className="text-[11px] font-medium text-gray-400 flex items-center justify-between">
                <span>Link para os corretores (WhatsApp):</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="input-field text-xs font-mono py-1.5 text-gray-300 select-all cursor-text"
                  onClick={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={handleCopiarLink}
                  className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0"
                  title="Copiar link"
                >
                  {copiado ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Imobiliárias Cadastradas */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-300">
              Todas as Imobiliárias ({empresas.length}):
            </label>
            {isSuperadmin && (
              <button
                onClick={() => {
                  onClose()
                  setShowNovaEmpresaModal(true)
                }}
                className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1"
                title="Cadastrar nova imobiliária manualmente (Superadmin)"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Imobiliária
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-6 text-center text-xs text-gray-500">
              Carregando lista de imobiliárias...
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {empresas.map((item) => {
                const isSelected = item.slug === empresa?.slug
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelecionarEmpresa(item.slug)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-brand-500/15 border-brand-500/40 text-brand-700 dark:text-brand-200 font-semibold'
                        : 'bg-surface-700/40 border-surface-600/60 text-gray-300 hover:bg-surface-700'
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-semibold truncate leading-tight">
                          {item.nome}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono">
                          /{item.slug}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="text-[10px] font-bold text-brand-600 dark:text-brand-300 bg-brand-500/20 px-2 py-0.5 rounded-md">
                        Atual
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full btn-ghost py-2.5 text-xs text-gray-400 hover:text-gray-200"
        >
          Fechar
        </button>
      </div>
    </div>,
    document.body
  )
}

