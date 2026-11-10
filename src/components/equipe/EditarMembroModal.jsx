import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Pencil,
  X,
  User,
  Phone,
  Mail,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react'
import {
  TIPOS_VALIDACAO,
  formatarWhatsApp,
  limparWhatsApp,
  isWhatsAppValido,
  normalizarEmail,
  isEmailValido,
  exigeWhatsApp,
  exigeEmail,
} from '../../lib/validacaoHelper'
import MembroDeviceVinculado from './MembroDeviceVinculado'

export default function EditarMembroModal({
  isOpen,
  colaborador,
  onClose,
  onSalvar,
  onDesvincularAparelho,
  tipoValidacao = TIPOS_VALIDACAO.WHATSAPP,
  termos = {},
  equipe = [],
  showToast,
}) {
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [salvando, setSalvando] = useState(false)

  const precisaZap = exigeWhatsApp(tipoValidacao)
  const precisaEmail = exigeEmail(tipoValidacao)

  useEffect(() => {
    if (!isOpen || !colaborador) {
      setNome('')
      setWhatsapp('')
      setEmail('')
      return
    }

    setNome(colaborador.nome || '')
    setWhatsapp(formatarWhatsApp(colaborador.whatsapp || ''))
    setEmail(colaborador.email || '')

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !salvando) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, colaborador, salvando, onClose])

  if (!isOpen || !colaborador) return null

  const emailPendente = precisaEmail && !colaborador.email
  const zapPendente = precisaZap && !colaborador.whatsapp

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nomeLimpo = nome.trim()
    const zapLimpo = limparWhatsApp(whatsapp)
    const emailLimpo = normalizarEmail(email)

    if (nomeLimpo.length < 2) {
      showToast?.(`Digite o nome completo d${termos.artigoPessoa || 'o'} ${termos.pessoa || 'colaborador'}.`, 'warning')
      return
    }

    if (precisaZap && !isWhatsAppValido(whatsapp)) {
      showToast?.('Digite um WhatsApp válido com DDD (mínimo 10 dígitos).', 'warning')
      return
    }

    if (!precisaZap && whatsapp.trim() && !isWhatsAppValido(whatsapp)) {
      showToast?.('O WhatsApp digitado é inválido. Digite com DDD ou deixe em branco.', 'warning')
      return
    }

    if (precisaEmail && !isEmailValido(email)) {
      showToast?.('Digite um e-mail corporativo válido.', 'warning')
      return
    }

    if (!precisaEmail && email.trim() && !isEmailValido(email)) {
      showToast?.('O e-mail digitado é inválido. Digite um e-mail correto ou deixe em branco.', 'warning')
      return
    }

    // Checagem de duplicidade com outros membros da equipe local
    if (zapLimpo) {
      const zapExistente = equipe.find(
        (c) => c.id !== colaborador.id && limparWhatsApp(c.whatsapp) === zapLimpo
      )
      if (zapExistente) {
        showToast?.(
          `Este WhatsApp já está cadastrado para "${zapExistente.nome}". Cada colaborador deve ter um número único.`,
          'warning'
        )
        return
      }
    }

    if (emailLimpo) {
      const emailExistente = equipe.find(
        (c) => c.id !== colaborador.id && normalizarEmail(c.email) === emailLimpo
      )
      if (emailExistente) {
        showToast?.(
          `Este e-mail já está cadastrado para "${emailExistente.nome}". Cada colaborador deve ter um e-mail único.`,
          'warning'
        )
        return
      }
    }

    setSalvando(true)
    try {
      const sucesso = await onSalvar({
        id: colaborador.id,
        nome: nomeLimpo,
        whatsapp: zapLimpo ? formatarWhatsApp(whatsapp) : null,
        email: emailLimpo || null,
      })

      if (sucesso) {
        onClose()
      }
    } finally {
      setSalvando(false)
    }
  }

  const isFormValido =
    nome.trim().length >= 2 &&
    (!precisaZap || isWhatsAppValido(whatsapp)) &&
    (!precisaEmail || isEmailValido(email))

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div
        className="bg-surface-850 border border-surface-700/80 rounded-2xl w-full max-w-md shadow-2xl relative animate-scale-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="p-4 sm:p-5 border-b border-surface-700/70 flex items-center justify-between bg-surface-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-100">
                Editar {termos.pessoa || 'Colaborador(a)'}
              </h3>
              <p className="text-[11px] text-gray-400 truncate max-w-[240px]">
                {colaborador.nome}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-750 transition-colors disabled:opacity-50"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {/* Alerta de E-mail Pendente */}
          {emailPendente && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200">E-mail corporativo pendente</p>
                <p className="text-[11px] text-amber-300/90 mt-0.5">
                  A sua empresa exige validação por e-mail. Adicione o e-mail corporativo abaixo para que este colaborador possa garantir vagas.
                </p>
              </div>
            </div>
          )}

          {/* Alerta de WhatsApp Pendente */}
          {zapPendente && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200">WhatsApp pendente</p>
                <p className="text-[11px] text-amber-300/90 mt-0.5">
                  A sua empresa exige validação por WhatsApp. Adicione o número abaixo para identificação do colaborador.
                </p>
              </div>
            </div>
          )}

          {/* Campo: Nome Completo */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-brand-400" />
              Nome Completo <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Carlos Eduardo"
              className="input-field w-full text-xs py-2.5 px-3"
              maxLength={60}
              required
            />
          </div>

          {/* Campo: WhatsApp */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-brand-400" />
              WhatsApp {precisaZap ? <span className="text-red-400">*</span> : <span className="text-gray-500 text-[11px]">(opcional)</span>}
            </label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatarWhatsApp(e.target.value))}
              placeholder="(11) 98765-4321"
              className="input-field w-full text-xs py-2.5 px-3 font-mono"
              maxLength={15}
            />
          </div>

          {/* Campo: E-mail Corporativo */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-brand-400" />
              E-mail Corporativo {precisaEmail ? <span className="text-red-400">*</span> : <span className="text-gray-500 text-[11px]">(opcional)</span>}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colaborador@empresa.com"
              className="input-field w-full text-xs py-2.5 px-3 lowercase"
              maxLength={100}
            />
          </div>

          {/* Informação de Celular Vinculado */}
          <MembroDeviceVinculado
            colaborador={colaborador}
            onDesvincular={onDesvincularAparelho}
            onClose={onClose}
          />

          {/* Botões de Ação */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-surface-700/60">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2 text-xs rounded-xl border border-surface-650 text-gray-300 hover:bg-surface-750 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !isFormValido}
              className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvar Alterações</span>
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

