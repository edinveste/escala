import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { UserCircle, X, Phone, User, ShieldCheck } from 'lucide-react'

// Máscara dinâmica para telefone brasileiro
function formatarWhatsApp(valor) {
  const digits = valor.replace(/\D/g, '').slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export default function NomeModal({
  onConfirm,
  onClose,
  initialNome = '',
  initialWhatsapp = '',
  exigirCadastro = false,
}) {
  const [nome, setNome] = useState(() => {
    return initialNome || localStorage.getItem('escala_corretor_nome') || ''
  })
  const [whatsapp, setWhatsapp] = useState(() => {
    const salvo = initialWhatsapp || localStorage.getItem('escala_corretor_whatsapp') || ''
    return formatarWhatsApp(salvo)
  })

  const nomeInputRef = useRef(null)
  const zapInputRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!nome.trim()) {
        nomeInputRef.current?.focus()
      } else {
        zapInputRef.current?.focus()
      }
    }, 120)

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(timer)
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, nome])

  const handleSubmit = (e) => {
    e.preventDefault()
    const nomeTrimmed = nome.trim()
    const digitsZap = whatsapp.replace(/\D/g, '')

    if (nomeTrimmed.length < 2) return
    if (digitsZap.length < 10) return

    onConfirm({
      nome: nomeTrimmed,
      whatsapp: formatarWhatsApp(whatsapp),
    })
  }

  const zapDigits = whatsapp.replace(/\D/g, '')
  const isValid = nome.trim().length >= 2 && zapDigits.length >= 10

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-surface-800 border border-surface-600 rounded-2xl sm:rounded-3xl p-6 animate-scale-in shadow-2xl max-h-[90vh] overflow-y-auto z-10">
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-surface-700 text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Ícone */}
        <div className="flex justify-center mb-3">
          <div className="p-3 rounded-2xl bg-brand-500/10 border border-brand-500/20">
            <UserCircle className="w-8 h-8 text-brand-400" />
          </div>
        </div>

        {/* Título */}
        <h2 className="text-xl font-bold text-center text-gray-100 mb-1">
          Identificação do Corretor
        </h2>
        <p className="text-xs text-gray-400 text-center mb-5 max-w-xs mx-auto">
          {exigirCadastro ? (
            <span className="flex items-center justify-center gap-1 text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              Esta imobiliária exige cadastro prévio de corretores.
            </span>
          ) : (
            'Informe seus dados para garantir sua vaga na escala de captação.'
          )}
        </p>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-brand-400" />
              Nome Completo
            </label>
            <input
              ref={nomeInputRef}
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Maria da Silva"
              className="input-field text-sm"
              maxLength={60}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-brand-400" />
              WhatsApp (com DDD)
            </label>
            <input
              ref={zapInputRef}
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatarWhatsApp(e.target.value))}
              placeholder="(11) 98765-4321"
              className="input-field text-sm font-mono"
              maxLength={15}
              autoComplete="tel"
            />
            {exigirCadastro && (
              <p className="text-[11px] text-gray-400 mt-1">
                ⚠️ Utilize o mesmo número de WhatsApp cadastrado na coordenação.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!isValid}
            className="btn-primary w-full py-3 text-sm font-semibold mt-2"
          >
            Confirmar e Garantir Vaga
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}
