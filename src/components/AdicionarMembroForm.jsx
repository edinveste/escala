import { useState } from 'react'
import {
  UserPlus,
  Phone,
  Mail,
  User,
  Loader2,
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
} from '../lib/validacaoHelper'

export default function AdicionarMembroForm({
  tipoValidacao = TIPOS_VALIDACAO.WHATSAPP,
  termos = {},
  equipe = [],
  onAdicionar,
  showToast,
}) {
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const precisaZap = exigeWhatsApp(tipoValidacao)
  const precisaEmail = exigeEmail(tipoValidacao)

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

    if (precisaEmail && !isEmailValido(email)) {
      showToast?.('Digite um e-mail corporativo válido.', 'warning')
      return
    }

    // Prevenção de duplicidade na equipe local (WhatsApp)
    if (precisaZap && zapLimpo) {
      const zapExistente = equipe.find(
        (c) => limparWhatsApp(c.whatsapp) === zapLimpo
      )
      if (zapExistente) {
        showToast?.(
          `Este WhatsApp já está cadastrado para "${zapExistente.nome}". Cada colaborador deve ter um número único.`,
          'warning'
        )
        return
      }
    }

    // Prevenção de duplicidade na equipe local (E-mail)
    if (precisaEmail && emailLimpo) {
      const emailExistente = equipe.find(
        (c) => normalizarEmail(c.email) === emailLimpo
      )
      if (emailExistente) {
        showToast?.(
          `Este e-mail já está cadastrado para "${emailExistente.nome}". Cada colaborador deve ter um e-mail único.`,
          'warning'
        )
        return
      }
    }

    setSubmitting(true)
    try {
      const sucesso = await onAdicionar({
        nome: nomeLimpo,
        whatsapp: precisaZap && zapLimpo ? formatarWhatsApp(whatsapp) : null,
        email: precisaEmail && emailLimpo ? emailLimpo : null,
      })

      if (sucesso) {
        setNome('')
        setWhatsapp('')
        setEmail('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Validação simples para habilitar botão
  const isFormValido =
    nome.trim().length >= 2 &&
    (!precisaZap || isWhatsAppValido(whatsapp)) &&
    (!precisaEmail || isEmailValido(email))

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3.5 sm:p-4 rounded-2xl bg-surface-800/80 border border-surface-700/80 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5 text-brand-400" />
          Cadastrar Nov{termos.artigoPessoa || 'o'} {termos.pessoa || 'Colaborador'} na Equipe
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Nome Completo */}
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1">
            Nome Completo <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <User className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Carlos Eduardo"
              className="input-field w-full text-xs py-2 pl-8 pr-3"
              maxLength={60}
            />
          </div>
        </div>

        {/* WhatsApp (apenas se a validação exigir WhatsApp) */}
        {precisaZap && (
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-1">
              WhatsApp <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(formatarWhatsApp(e.target.value))}
                placeholder="(11) 98765-4321"
                className="input-field w-full text-xs py-2 pl-8 pr-3 font-mono"
                maxLength={15}
              />
            </div>
          </div>
        )}

        {/* E-mail Corporativo (apenas se a validação exigir E-mail) */}
        {precisaEmail && (
          <div className={tipoValidacao === TIPOS_VALIDACAO.AMBOS ? 'col-span-1 sm:col-span-2' : ''}>
            <label className="block text-[11px] font-medium text-gray-400 mb-1">
              E-mail Corporativo <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colaborador@empresa.com"
                className="input-field w-full text-xs py-2 pl-8 pr-3 lowercase"
                maxLength={100}
              />
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting || !isFormValido}
        className="btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Salvando na equipe...</span>
          </>
        ) : (
          <>
            <UserPlus className="w-4 h-4" />
            <span>Autorizar {termos.pessoa || 'Colaborador'} na Equipe</span>
          </>
        )}
      </button>
    </form>
  )
}

