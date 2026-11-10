import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
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
import IdentificacaoFormStep from './nome-modal/IdentificacaoFormStep'
import ConfirmacaoDuplaStep from './nome-modal/ConfirmacaoDuplaStep'

/**
 * Modal orquestrador de identificação do colaborador.
 * Gerencia a identificação zero-atrito, checagem anti-spoofing em tempo real
 * e a etapa de confirmação dupla com aviso de fixação no aparelho.
 */
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

  // Etapa 2: Confirmação dupla antes de fixar definitivamente no aparelho
  const [confirmandoDuplo, setConfirmandoDuplo] = useState(false)

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
    if (confirmandoDuplo) return

    const timer = setTimeout(() => {
      if (errorMessage || (exigirCadastro && !membroAutorizado)) {
        if (tipoValidacao === TIPOS_VALIDACAO.EMAIL) {
          emailInputRef.current?.focus()
          emailInputRef.current?.select()
        } else {
          zapInputRef.current?.focus()
          zapInputRef.current?.select()
        }
      } else {
        nomeInputRef.current?.focus()
        nomeInputRef.current?.select()
      }
    }, 120)

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (confirmandoDuplo) {
          setConfirmandoDuplo(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(timer)
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, errorMessage, exigirCadastro, membroAutorizado, tipoValidacao, confirmandoDuplo])

  const precisaZap = Boolean(exigirCadastro && exigeWhatsApp(tipoValidacao))
  const precisaEmail = Boolean(exigirCadastro && exigeEmail(tipoValidacao))

  const isNomeConflitante = Boolean(
    exigirCadastro &&
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

  // Avança para a tela de confirmação dupla
  const handleSubmit = (e) => {
    e.preventDefault()
    const nomeTrimmed = (membroAutorizado || nome).trim()

    if (nomeTrimmed.length < 2) return
    if (precisaZap && !isWhatsAppValido(whatsapp)) return
    if (precisaEmail && !isEmailValido(email)) return
    if (exigirCadastro && naoEncontrado) return
    if (isNomeConflitante) return

    setConfirmandoDuplo(true)
  }

  // Conclui a fixação da identificação após a confirmação dupla
  const handleFinalizarConfirmacao = useCallback(() => {
    const nomeTrimmed = (membroAutorizado || nome).trim()
    onConfirm({
      nome: nomeTrimmed,
      whatsapp: precisaZap ? formatarWhatsApp(whatsapp) : null,
      email: precisaEmail ? normalizarEmail(email) : null,
    })
  }, [membroAutorizado, nome, onConfirm, precisaZap, whatsapp, precisaEmail, email])

  const nomeExibicao = (membroAutorizado || nome).trim()

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
        onClick={() => {
          if (confirmandoDuplo) {
            setConfirmandoDuplo(false)
          } else {
            onClose()
          }
        }}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-md bg-surface-800 border border-surface-600 rounded-2xl sm:rounded-3xl p-6 animate-scale-in shadow-2xl max-h-[90vh] overflow-y-auto z-10">
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-surface-700 text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {confirmandoDuplo ? (
          <ConfirmacaoDuplaStep
            nomeExibicao={nomeExibicao}
            precisaZap={precisaZap}
            whatsapp={whatsapp}
            precisaEmail={precisaEmail}
            email={email}
            termos={termos}
            hasPendingTurno={hasPendingTurno}
            onConfirm={handleFinalizarConfirmacao}
            onBack={() => setConfirmandoDuplo(false)}
          />
        ) : (
          <IdentificacaoFormStep
            termos={termos}
            exigirCadastro={exigirCadastro}
            errorMessage={errorMessage}
            erroIdentidade={erroIdentidade}
            tipoValidacao={tipoValidacao}
            onSubmit={handleSubmit}
            isValid={isValid}
            whatsapp={whatsapp}
            setWhatsapp={setWhatsapp}
            email={email}
            setEmail={setEmail}
            nome={nome}
            setNome={setNome}
            membroAutorizado={membroAutorizado}
            verificando={verificando}
            naoEncontrado={naoEncontrado}
            nomeExistenteReservas={nomeExistenteReservas}
            isNomeConflitante={isNomeConflitante}
            zapInputRef={zapInputRef}
            emailInputRef={emailInputRef}
            nomeInputRef={nomeInputRef}
          />
        )}
      </div>
    </div>,
    document.body
  )
}
