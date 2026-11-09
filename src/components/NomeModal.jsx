import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  UserCircle,
  X,
  ShieldCheck,
  AlertCircle,
  UserCheck,
  AlertTriangle,
  Check,
  ArrowLeft,
  User,
  Phone,
  Mail,
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
  const handleFinalizarConfirmacao = () => {
    const nomeTrimmed = (membroAutorizado || nome).trim()
    onConfirm({
      nome: nomeTrimmed,
      whatsapp: precisaZap ? formatarWhatsApp(whatsapp) : null,
      email: precisaEmail ? normalizarEmail(email) : null,
    })
  }

  // Atalho de teclado Enter na etapa de confirmação
  useEffect(() => {
    if (!confirmandoDuplo) return
    const handleKey = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleFinalizarConfirmacao()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [confirmandoDuplo, nome, whatsapp, email, membroAutorizado, precisaZap, precisaEmail])

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

        {confirmandoDuplo ? (
          /* ═══════════════════════════════════════════════════════════════════
             ETAPA 2: CONFIRMAÇÃO DUPLA ANTES DE FIXAR DEFINITIVAMENTE NO APARELHO
             ═══════════════════════════════════════════════════════════════════ */
          <div className="animate-fade-in">
            {/* Ícone */}
            <div className="flex justify-center mb-3">
              <div className="p-3.5 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
                <UserCheck className="w-8 h-8" />
              </div>
            </div>

            {/* Título */}
            <h2 className="text-xl font-bold text-center text-gray-100 mb-1">
              Confirmar Nome
            </h2>
            <p className="text-xs text-gray-400 text-center mb-4 max-w-xs mx-auto">
              Verifique atentamente seu nome antes de fixá-lo neste aparelho.
            </p>

            {/* Cartão de Exibição dos Dados Informados */}
            <div className="p-4 rounded-2xl bg-surface-900 border border-surface-700/80 space-y-2 mb-4">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
                Nome do {termos.pessoa || 'Colaborador(a)'}:
              </span>
              <p className="text-lg font-bold text-gray-100 flex items-center gap-2">
                <User className="w-5 h-5 text-brand-400 shrink-0" />
                <span className="break-words">{nomeExibicao}</span>
              </p>

              {precisaZap && whatsapp && (
                <div className="pt-2 border-t border-surface-800 flex items-center gap-2 text-xs text-gray-300">
                  <Phone className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                  <span className="font-mono">{whatsapp}</span>
                </div>
              )}

              {precisaEmail && email && (
                <div className="pt-2 border-t border-surface-800 flex items-center gap-2 text-xs text-gray-300">
                  <Mail className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                  <span className="font-mono lowercase">{email}</span>
                </div>
              )}
            </div>

            {/* Alerta de Fixação Permanente (Exclusivo para Gestor alterar) */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 flex items-start gap-2.5 mb-5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <p className="font-bold text-amber-300">Atenção: Fixação no Aparelho</p>
                <p className="mt-1 text-amber-200/90 text-[11px]">
                  Este nome ficará gravado no seu aparelho para todas as reservas e <strong>não poderá ser alterado por aqui</strong>.
                </p>
                <p className="mt-1 text-amber-300/85 text-[11px]">
                  Caso precise corrigir ou alterar futuramente, será necessário solicitar diretamente ao seu <strong>gestor</strong>.
                </p>
              </div>
            </div>

            {/* Ações de Confirmação Dupla */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleFinalizarConfirmacao}
                className="btn-primary w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 active:scale-98 transition-all"
              >
                <Check className="w-4 h-4" />
                <span>{hasPendingTurno ? 'Sim, confirmar e garantir vaga' : 'Sim, confirmar e fixar meu nome'}</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmandoDuplo(false)}
                className="w-full py-2.5 text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-surface-700/50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Não, quero corrigir meu nome</span>
              </button>
            </div>
          </div>
        ) : (
          /* ═══════════════════════════════════════════════════════════════════
             ETAPA 1: DIGITAÇÃO DO NOME (OU WHATSAPP/EMAIL SE PROTEGIDO)
             ═══════════════════════════════════════════════════════════════════ */
          <div className="animate-fade-in">
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
                `Informe seu nome para ${termos.acaoVaga?.toLowerCase() || 'garantir sua vaga na escala'}.`
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
                className="btn-primary w-full py-3 text-sm font-semibold mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>Continuar e Confirmar Nome</span>
                <span aria-hidden="true">→</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
