import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  Phone,
  Mail,
  Repeat,
  Check,
  ShieldAlert,
  Loader2,
} from 'lucide-react'
import {
  TIPOS_VALIDACAO,
  OPCOES_VALIDACAO,
} from '../lib/validacaoHelper'

const ICON_MAP = {
  Phone,
  Mail,
  Repeat,
}

export default function TipoValidacaoSelector({
  empresaId,
  tipoAtual = TIPOS_VALIDACAO.WHATSAPP,
  onTipoChange,
  isFullAdmin = true,
  showToast,
}) {
  const [salvando, setSalvando] = useState(false)

  const handleSelectTipo = async (novoTipo) => {
    if (novoTipo === tipoAtual || salvando) return

    if (!isFullAdmin) {
      showToast?.('Apenas administradores podem alterar a política de identificação.', 'warning')
      return
    }

    setSalvando(true)
    try {
      let sucesso = false

      // 1. Tenta executar via RPC segura
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'alternar_tipo_validacao_equipe',
          {
            p_empresa_id: empresaId,
            p_tipo_validacao: novoTipo,
          }
        )
        if (!rpcError && rpcData === true) {
          sucesso = true
        }
      } catch (errRpc) {
        // Fallback para update direto
      }

      // 2. Fallback direto se a RPC não rodar
      if (!sucesso) {
        const { error: updateError } = await supabase
          .from('empresas')
          .update({ tipo_validacao_equipe: novoTipo })
          .eq('id', empresaId)

        if (updateError) throw updateError
      }

      onTipoChange?.(novoTipo)

      const opcao = OPCOES_VALIDACAO.find((o) => o.id === novoTipo)
      showToast?.(
        `Política alterada para "${opcao?.label || novoTipo}" com sucesso! ✅`,
        'success'
      )
    } catch (err) {
      console.error('Erro ao atualizar política de validação:', err)
      showToast?.('Erro ao atualizar a política de identificação da equipe.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-surface-800/80 border border-surface-700/80 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
            Identificação da Equipe
          </label>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Escolha os dados exigidos para identificar o colaborador quando a proteção contra invasores estiver ativada.
          </p>
        </div>
        {salvando && (
          <span className="text-[11px] text-brand-400 flex items-center gap-1 font-medium">
            <Loader2 className="w-3 h-3 animate-spin" />
            Salvando...
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {OPCOES_VALIDACAO.map((opcao) => {
          const Icone = ICON_MAP[opcao.icone] || Phone
          const isAtivo = tipoAtual === opcao.id

          return (
            <button
              key={opcao.id}
              type="button"
              disabled={salvando || !isFullAdmin}
              onClick={() => handleSelectTipo(opcao.id)}
              className={`relative flex flex-col p-3 rounded-xl border text-left transition-all duration-150 min-h-[52px] ${
                isAtivo
                  ? 'bg-brand-500/15 border-brand-500/50 shadow-sm shadow-brand-500/10'
                  : 'bg-surface-750/70 border-surface-650 hover:border-surface-550 hover:bg-surface-700/70'
              } ${!isFullAdmin ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`p-1.5 rounded-lg ${
                      isAtivo
                        ? 'bg-brand-500 text-white'
                        : 'bg-surface-700 text-gray-400'
                    }`}
                  >
                    <Icone className="w-3.5 h-3.5" />
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      isAtivo ? 'text-brand-300' : 'text-gray-200'
                    }`}
                  >
                    {opcao.shortLabel}
                  </span>
                </div>

                {isAtivo ? (
                  <div className="w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded-full border border-surface-500 shrink-0" />
                )}
              </div>

              <p className="text-[10px] text-gray-400 leading-tight mt-0.5 line-clamp-2">
                {opcao.descricao}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

