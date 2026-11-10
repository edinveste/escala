import { UserCircle, ShieldCheck, AlertCircle } from 'lucide-react'
import { TIPOS_VALIDACAO } from '../../lib/validacaoHelper'
import IdentificacaoCampos from './IdentificacaoCampos'

/**
 * Etapa 1 do NomeModal:
 * Formulário inicial para digitação e validação do nome (e WhatsApp/E-mail corporativo se exigido).
 */
export default function IdentificacaoFormStep({
  termos = {},
  exigirCadastro = false,
  errorMessage = '',
  erroIdentidade = '',
  tipoValidacao = TIPOS_VALIDACAO.WHATSAPP,
  onSubmit,
  isValid = false,
  // Props repassadas para o IdentificacaoCampos
  whatsapp,
  setWhatsapp,
  email,
  setEmail,
  nome,
  setNome,
  membroAutorizado,
  verificando,
  naoEncontrado,
  nomeExistenteReservas,
  isNomeConflitante,
  zapInputRef,
  emailInputRef,
  nomeInputRef,
}) {
  return (
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
      <form onSubmit={onSubmit} className="space-y-4">
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
  )
}

