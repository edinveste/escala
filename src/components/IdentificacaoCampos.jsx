import {
  Phone,
  Mail,
  User,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import {
  TIPOS_VALIDACAO,
  formatarWhatsApp,
  exigeWhatsApp,
  exigeEmail,
} from '../lib/validacaoHelper'

export default function IdentificacaoCampos({
  tipoValidacao = TIPOS_VALIDACAO.WHATSAPP,
  whatsapp,
  setWhatsapp,
  email,
  setEmail,
  nome,
  setNome,
  membroAutorizado,
  verificando,
  naoEncontrado,
  exigirCadastro = false,
  nomeExistenteReservas,
  isNomeConflitante,
  termos = {},
  zapInputRef,
  emailInputRef,
  nomeInputRef,
  errorMessage,
}) {
  // Quando a proteção contra invasores estiver desativada (Acesso Livre), exige APENAS o nome
  const precisaZap = Boolean(exigirCadastro && exigeWhatsApp(tipoValidacao))
  const precisaEmail = Boolean(exigirCadastro && exigeEmail(tipoValidacao))

  return (
    <div className="space-y-3.5">
      {/* ─── CAMPO DE WHATSAPP (SE EXIGIDO) ─── */}
      {precisaZap && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-brand-400" />
              WhatsApp (com DDD)
            </label>
            {verificando && tipoValidacao === TIPOS_VALIDACAO.WHATSAPP && (
              <span className="text-[11px] text-brand-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Verificando...
              </span>
            )}
          </div>
          <input
            ref={zapInputRef}
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(formatarWhatsApp(e.target.value))}
            placeholder="(11) 98765-4321"
            className={`input-field text-sm font-mono ${
              (naoEncontrado && tipoValidacao === TIPOS_VALIDACAO.WHATSAPP) || errorMessage
                ? 'border-red-500/50 focus:border-red-400 focus:ring-red-500/20'
                : membroAutorizado && tipoValidacao === TIPOS_VALIDACAO.WHATSAPP
                ? 'border-emerald-500/50 focus:border-emerald-400 focus:ring-emerald-500/20'
                : ''
            }`}
            maxLength={15}
            autoComplete="tel"
          />

          {tipoValidacao === TIPOS_VALIDACAO.WHATSAPP && membroAutorizado && (
            <p className="text-[11px] text-emerald-400 mt-1.5 flex items-center gap-1 font-medium animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Cadastro autorizado: <strong>{membroAutorizado}</strong>
            </p>
          )}

          {tipoValidacao === TIPOS_VALIDACAO.WHATSAPP && naoEncontrado && (
            <p className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1 font-medium animate-fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Este número não consta na equipe autorizada da empresa.
            </p>
          )}
        </div>
      )}

      {/* ─── CAMPO DE E-MAIL CORPORATIVO (SE EXIGIDO) ─── */}
      {precisaEmail && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-brand-400" />
              E-mail Corporativo
            </label>
            {verificando && (
              <span className="text-[11px] text-brand-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Verificando...
              </span>
            )}
          </div>
          <input
            ref={emailInputRef}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
            placeholder="colaborador@empresa.com"
            className={`input-field text-sm lowercase ${
              naoEncontrado || errorMessage
                ? 'border-red-500/50 focus:border-red-400 focus:ring-red-500/20'
                : membroAutorizado
                ? 'border-emerald-500/50 focus:border-emerald-400 focus:ring-emerald-500/20'
                : ''
            }`}
            maxLength={100}
            autoComplete="email"
          />

          {tipoValidacao !== TIPOS_VALIDACAO.WHATSAPP && membroAutorizado && (
            <p className="text-[11px] text-emerald-400 mt-1.5 flex items-center gap-1 font-medium animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Cadastro autorizado: <strong>{membroAutorizado}</strong>
            </p>
          )}

          {tipoValidacao !== TIPOS_VALIDACAO.WHATSAPP && naoEncontrado && (
            <p className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1 font-medium animate-fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {tipoValidacao === TIPOS_VALIDACAO.AMBOS
                ? 'WhatsApp e E-mail não coincidem com o cadastro da equipe.'
                : 'Este e-mail corporativo não consta na equipe autorizada.'}
            </p>
          )}
        </div>
      )}

      {/* ─── CAMPO DE NOME COMPLETO ─── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-brand-400" />
            Nome Completo
          </label>
          {membroAutorizado && exigirCadastro && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1 font-medium">
              <Lock className="w-2.5 h-2.5" />
              Oficial da Equipe
            </span>
          )}
        </div>
        <input
          ref={nomeInputRef}
          type="text"
          value={membroAutorizado || nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={`Ex: Maria da Silva`}
          className={`input-field text-sm ${
            membroAutorizado && exigirCadastro
              ? 'bg-surface-700/60 cursor-not-allowed text-gray-200 border-surface-600'
              : ''
          }`}
          maxLength={60}
          autoComplete="name"
          readOnly={Boolean(membroAutorizado && exigirCadastro)}
        />

        {/* Alerta de conflito de nome para os mesmos dados quando sem pré-cadastro */}
        {isNomeConflitante && (
          <p className="text-[11px] text-amber-400 mt-1.5 flex items-start gap-1 font-medium animate-fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Estes dados já estão registrados para "{nomeExistenteReservas}". Para reservar, utilize o mesmo nome ou informe seus próprios dados.
          </p>
        )}
      </div>
    </div>
  )
}

