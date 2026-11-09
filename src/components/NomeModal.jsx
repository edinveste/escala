import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  UserCircle,
  X,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'
import {
  TIPOS_VALIDACAO,
  formatarWhatsApp,
  normalizarEmail,
  isEmailValido,
  isWhatsAppValido,
  exigeWhatsApp,
  exigeEmail,
} from '../lib/validacaoHelper'
import { useVerificacaoIdentidade } from '../hooks/useVerificacaoIdentidade'
import IdentificacaoCampos from './IdentificacaoCampos'

export default function NomeModal({
  onConfirm,
  onClose,
  initialNome = '',
  initialWhatsapp = '',
  initialEmail = '',
  deviceId = '',
  tipoValidacao = TIPOS_VALIDACAO.WHATSAPP,
  exigirCadastro = false,
  empresaId = null,
  termos = {},
  errorMessage = '',
  hasPendingTurno = true,
}) {
  const [nome, setNome] = useState(() => {
    return initialNome || localStorage.getItem('escala_corretor_nome') || ''
  })
  const [whatsapp, setWhatsapp] = useState(() => {
    const salvo = initialWhatsapp || localStorage.getItem('escala_corretor_whatsapp') || ''
    return formatarWhatsApp(salvo)
  })
  const [email, setEmail] = useState(() => {
    const salvo = initialEmail || localStorage.getItem('escala_corretor_email') || ''
    return normalizarEmail(salvo)
  })

  // Sincroniza se as props mudarem ao reabrir
  useEffect(() => {
    if (initialNome && initialNome !== nome) {
      setNome(initialNome)
    }
  }, [initialNome])

  useEffect(() => {
    if (initialWhatsapp) {
      setWhatsapp(formatarWhatsApp(initialWhatsapp))
    }
  }, [initialWhatsapp])

  useEffect(() => {
    if (initialEmail) {
      setEmail(normalizarEmail(initialEmail))
    }
  }, [initialEmail])

  const nomeInputRef = useRef(null)
  const zapInputRef = useRef(null)
  const emailInputRef = useRef(null)

  // ─── Hook Customizado de Verificação de Identidade (Realtime Anti-Spoofing) ───
  const {
    membroAutorizado,
    verificando,
    naoEncontrado,
    mensagemErro: erroIdentidade,
    nomeExistenteReservas,
  } = useVerificacaoIdentidade({
    empresaId,
    tipoValidacao,
    exigirCadastro,
    whatsapp,
    email,
    nome,
    deviceId,
  })

  // Atualiza o nome automaticamente quando o membro for autorizado na equipe
  useEffect(() => {
    if (membroAutorizado) {
      setNome(membroAutorizado)
    }
  }, [membroAutorizado])

  // Se não exigir cadastro prévio e for detectado conflito com outra reserva, sugere o nome
  useEffect(() => {
    if (!exigirCadastro && nomeExistenteReservas && !nome.trim()) {
      setNome(nomeExistenteReservas)
    }
  }, [exigirCadastro, nomeExistenteReservas, nome])

  // ─── Auto-foco inteligente e bloqueio de rolagem do body ───
  useEffect(() => {
    const timer = setTimeout(() => {
      if (errorMessage || (exigirCadastro && !membroAutorizado)) {
        if (tipoValidacao === TIPOS_VALIDACAO.EMAIL) {
          emailInputRef.current?.focus()
          emailInputRef.current?.select()
        } else {
          zapInputRef.current?.focus()
          zapInputRef.current?.select()
        }
      } else if (!nome.trim()) {
        nomeInputRef.current?.focus()
      } else if (tipoValidacao === TIPOS_VALIDACAO.EMAIL) {
        emailInputRef.current?.focus()
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
  }, [onClose, errorMessage, exigirCadastro, membroAutorizado, tipoValidacao])

  const handleSubmit = (e) => {
    e.preventDefault()
    const nomeTrimmed = (membroAutorizado || nome).trim()
    const precisaZap = exigeWhatsApp(tipoValidacao)
    const precisaEmail = exigeEmail(tipoValidacao)

    if (nomeTrimmed.length < 2) return
    if (precisaZap && !isWhatsAppValido(whatsapp)) return
    if (precisaEmail && !isEmailValido(email)) return
    if (exigirCadastro && naoEncontrado) return

    onConfirm({
      nome: nomeTrimmed,
      whatsapp: precisaZap ? formatarWhatsApp(whatsapp) : (whatsapp ? formatarWhatsApp(whatsapp) : null),
      email: precisaEmail ? normalizarEmail(email) : (email ? normalizarEmail(email) : null),
    })
  }

  const precisaZap = exigeWhatsApp(tipoValidacao)
  const precisaEmail = exigeEmail(tipoValidacao)

  const isNomeConflitante = Boolean(
    !exigirCadastro &&
    nomeExistenteReservas &&
    nome.trim() &&
    nomeExistenteReservas.trim().toLowerCase() !== nome.trim().toLowerCase()
  )

  const isValid =
    (membroAutorizado || nome.trim().length >= 2) &&
    (!precisaZap || isWhatsAppValido(whatsapp)) &&
    (!precisaEmail || isEmailValido(email)) &&
    !(exigirCadastro && naoEncontrado) &&
    !isNomeConflitante &&
    !verificando

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
          Identificação d{termos.artigoPessoa || 'o'} {termos.pessoa || 'Colaborador'}
        </h2>
        <p className="text-xs text-gray-400 text-center mb-4 max-w-xs mx-auto">
          {exigirCadastro ? (
            <span className="flex items-center justify-center gap-1 text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              Esta empresa exige cadastro prévio de {termos.pessoas?.toLowerCase() || 'colaboradores'}.
            </span>
          ) : (
            `Informe seus dados para ${termos.acaoVaga?.toLowerCase() || 'garantir sua vaga na escala'}.`
          )}
        </p>

        {/* Alerta de erro de cadastro / autorização */}
        {(errorMessage || erroIdentidade) && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 flex items-start gap-2.5 animate-scale-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-200">{erroIdentidade || errorMessage}</p>
              {!erroIdentidade && (
                <p className="text-[11px] text-red-300/80 mt-1">
                  {tipoValidacao === TIPOS_VALIDACAO.EMAIL
                    ? 'Verifique se digitou seu e-mail corporativo corretamente. Se estiver correto, solicite à coordenação sua inclusão na equipe autorizada.'
                    : tipoValidacao === TIPOS_VALIDACAO.AMBOS
                    ? 'Verifique se digitou o WhatsApp e E-mail corporativo corretamente. Solicite à coordenação sua inclusão na equipe autorizada.'
                    : 'Verifique se digitou o DDD e o número com atenção. Solicite à coordenação sua inclusão na equipe autorizada.'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Formulário Modularizado */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <IdentificacaoCampos
            tipoValidacao={tipoValidacao}
            whatsapp={whatsapp}
            setWhatsapp={setWhatsapp}
            email={email}
            setEmail={setEmail}
            nome={nome}
            setNome={setNome}
            membroAutorizado={membroAutorizado}
            verificando={verificando}
            naoEncontrado={naoEncontrado}
            exigirCadastro={exigirCadastro}
            nomeExistenteReservas={nomeExistenteReservas}
            isNomeConflitante={isNomeConflitante}
            termos={termos}
            zapInputRef={zapInputRef}
            emailInputRef={emailInputRef}
            nomeInputRef={nomeInputRef}
            errorMessage={errorMessage}
          />

          <button
            type="submit"
            disabled={!isValid}
            className="btn-primary w-full py-3 text-sm font-semibold mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {hasPendingTurno ? 'Confirmar e Garantir Vaga' : 'Salvar Alterações'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}
