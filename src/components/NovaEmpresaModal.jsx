import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabaseClient'
import { slugify, getTenantShareUrl } from '../lib/tenantHelper'
import { useTenant } from '../contexts/TenantContext'
import { useAuth } from '../contexts/AuthContext'
import { Building2, X, Plus, Sparkles, Link as LinkIcon, Lock } from 'lucide-react'

export default function NovaEmpresaModal({ isOpen, onClose, showToast }) {
  const { switchTenant } = useTenant()
  const { refreshAuth } = useAuth()
  const [nome, setNome] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [pin, setPin] = useState('1234')
  const [salvando, setSalvando] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      setNome('')
      setSlug('')
      setSlugManual(false)
      setPin('1234')
      return
    }

    const timer = setTimeout(() => inputRef.current?.focus(), 100)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !salvando) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(timer)
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, salvando, onClose])

  if (!isOpen) return null

  const handleNomeChange = (e) => {
    const val = e.target.value
    setNome(val)
    if (!slugManual) {
      setSlug(slugify(val))
    }
  }

  const handleSlugChange = (e) => {
    setSlugManual(true)
    setSlug(slugify(e.target.value))
  }

  const handleSalvar = async (e) => {
    if (e) e.preventDefault()
    const nomeLimpo = nome.trim()
    const slugLimpo = slugify(slug)
    const pinLimpo = pin.trim()

    if (!nomeLimpo) {
      showToast('Digite o nome da empresa/imobiliária.', 'warning')
      return
    }

    if (!slugLimpo || slugLimpo.length < 2) {
      showToast('O identificador (slug) deve ter pelo menos 2 caracteres.', 'warning')
      return
    }

    if (pinLimpo.length < 4) {
      showToast('O PIN de admin deve ter no mínimo 4 dígitos.', 'warning')
      return
    }

    setSalvando(true)
    try {
      // 1. Tenta via RPC criar_nova_empresa
      const { data: rpcData, error: rpcError } = await supabase.rpc('criar_nova_empresa', {
        p_nome: nomeLimpo,
        p_slug: slugLimpo,
        p_admin_pin: pinLimpo,
      })

      if (!rpcError && rpcData) {
        showToast(`Imobiliária "${nomeLimpo}" criada com sucesso! 🏢`, 'success')
        await refreshAuth()
        onClose()
        switchTenant(slugLimpo)
        return
      }

      // Se der erro de slug duplicado na RPC
      if (rpcError && rpcError.message.includes('em uso')) {
        showToast('Este identificador (slug) já está em uso. Escolha outro.', 'error')
        return
      }

      // 2. Fallback caso a RPC ainda não exista no banco
      const { data: novaEmpresa, error: errInsert } = await supabase
        .from('empresas')
        .insert({
          nome: nomeLimpo,
          slug: slugLimpo,
          admin_pin: pinLimpo,
          plano: 'trial',
          status: 'ativo',
        })
        .select()
        .single()

      if (errInsert) {
        if (errInsert.code === '23505' || errInsert.message.includes('unique')) {
          showToast('Este identificador (slug) já está cadastrado. Altere o slug.', 'error')
          return
        }
        throw errInsert
      }

      showToast(`Imobiliária "${nomeLimpo}" criada com sucesso! 🏢`, 'success')
      onClose()
      switchTenant(novaEmpresa.slug)
    } catch (err) {
      console.error('Erro ao cadastrar empresa:', err)
      showToast('Erro ao criar imobiliária. Verifique as permissões.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const previewUrl = getTenantShareUrl(slug || 'sua-imobiliaria')

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
        onClick={() => !salvando && onClose()}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-surface-800 border border-surface-600 rounded-2xl sm:rounded-3xl p-6 shadow-2xl animate-scale-in z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-100">
                Nova Imobiliária / Tenant
              </h3>
              <p className="text-xs text-gray-400">
                Crie um ambiente isolado para o seu novo cliente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={salvando}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSalvar} className="space-y-4">
          {/* Nome da Imobiliária */}
          <div>
            <label className="text-xs font-semibold text-gray-300 mb-1.5 block">
              Nome da Imobiliária ou Construtora:
            </label>
            <input
              ref={inputRef}
              type="text"
              value={nome}
              onChange={handleNomeChange}
              placeholder="Ex: Direcional Imóveis, Remax Prime"
              className="input-field text-sm"
              required
            />
          </div>

          {/* Slug de URL */}
          <div>
            <label className="text-xs font-semibold text-gray-300 mb-1.5 flex items-center justify-between">
              <span>Link de Acesso (Slug):</span>
              {slugManual && (
                <button
                  type="button"
                  onClick={() => {
                    setSlugManual(false)
                    setSlug(slugify(nome))
                  }}
                  className="text-[11px] text-brand-400 hover:underline"
                >
                  Automático
                </button>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                value={slug}
                onChange={handleSlugChange}
                placeholder="ex: direcional-imoveis"
                className="input-field pr-10 font-mono text-xs sm:text-sm text-brand-600 dark:text-brand-300"
                required
              />
              <LinkIcon className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Preview do Link */}
            <div className="mt-1.5 p-2 rounded-lg bg-surface-900/60 border border-surface-700 text-[11px] text-gray-400 truncate">
              URL da equipe:{' '}
              <span className="font-mono text-brand-600 dark:text-brand-300 font-semibold select-all">
                {previewUrl}
              </span>
            </div>
          </div>

          {/* PIN de Acesso do Gestor */}
          <div>
            <label className="text-xs font-semibold text-gray-300 mb-1.5 block">
              PIN Inicial do Gestor:
            </label>
            <div className="relative">
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Mínimo 4 dígitos"
                className="input-field pr-10 font-mono text-sm tracking-widest text-center"
                required
              />
              <Lock className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              O gestor desta imobiliária usará este PIN para gerenciar horários e pontos.
            </p>
          </div>

          {/* Botões */}
          <div className="flex gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="btn-ghost flex-1 py-3 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !nome.trim() || !slug.trim()}
              className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2"
            >
              {salvando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Criar Imobiliária
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

