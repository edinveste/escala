import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

/**
 * Card de controle de privacidade e anonimato na escala pública.
 * Permite que gestores ocultem os nomes dos colegas para quem acessa a escala,
 * exibindo apenas "Reservado" para terceiros e preservando a identificação do próprio usuário ("VOCÊ").
 * No painel administrativo, o gestor sempre vê todos os nomes reais.
 */
export default function EscalaPrivacidadeCard({
  empresa,
  onEmpresaUpdated,
  showToast,
  isFullAdmin = true,
  termos = {},
}) {
  const [salvando, setSalvando] = useState(false)

  if (!isFullAdmin) return null

  const ocultarAtivo = Boolean(
    empresa?.ocultar_nomes_escala || empresa?.termos?.ocultarNomesEscala
  )

  const handleToggle = async () => {
    if (!isFullAdmin) {
      showToast?.('Apenas administradores podem alterar a privacidade da escala.', 'warning')
      return
    }

    const novoStatus = !ocultarAtivo
    setSalvando(true)

    try {
      const novosTermos = {
        ...(empresa?.termos || {}),
        ocultarNomesEscala: novoStatus,
      }

      const payload = {
        ocultar_nomes_escala: novoStatus,
        termos: novosTermos,
      }

      let sucesso = false
      try {
        const { error } = await supabase
          .from('empresas')
          .update(payload)
          .eq('id', empresa.id)

        if (!error) sucesso = true
      } catch (errDb) {
        // Fallback silencioso se a coluna ainda não foi adicionada no Postgres
      }

      // Se a coluna ainda não existir no Postgres, salva com segurança dentro de 'termos' (JSONB)
      if (!sucesso) {
        const { error: errFallback } = await supabase
          .from('empresas')
          .update({ termos: novosTermos })
          .eq('id', empresa.id)

        if (errFallback) throw errFallback
      }

      onEmpresaUpdated?.({
        ...empresa,
        ocultar_nomes_escala: novoStatus,
        termos: novosTermos,
      })

      showToast?.(
        novoStatus
          ? 'Modo anônimo ativado! Os nomes dos colegas agora estão ocultos aos colaboradores. 🙈'
          : 'Nomes visíveis! Os colaboradores agora conseguem ver os nomes na escala pública. 👁️',
        novoStatus ? 'success' : 'info'
      )
    } catch (err) {
      console.error('Erro ao alternar privacidade da escala:', err)
      showToast?.('Erro ao atualizar configuração de privacidade da escala.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-800/90 border-surface-600">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`p-2.5 rounded-xl border flex-shrink-0 transition-colors ${
            ocultarAtivo
              ? 'bg-purple-500/10 border-purple-500/25 text-purple-400'
              : 'bg-surface-700/80 border-surface-600 text-gray-400'
          }`}
        >
          {ocultarAtivo ? (
            <EyeOff className="w-5 h-5 text-purple-400" />
          ) : (
            <Eye className="w-5 h-5 text-gray-400" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-gray-200 truncate">
              Privacidade dos Nomes
            </h3>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1 ${
                ocultarAtivo
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                  : 'bg-surface-700 text-gray-400 border-surface-600'
              }`}
            >
              {ocultarAtivo ? (
                <>
                  <EyeOff className="w-3 h-3" />
                  <span>Modo Anônimo Ativo</span>
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3" />
                  <span>Nomes Visíveis</span>
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 leading-snug">
            {ocultarAtivo
              ? 'Nomes dos colegas ocultos para colaboradores (exibe "Reservado"). No painel de gestão você continua vendo todos.'
              : 'Colaboradores visualizam os nomes uns dos outros ao reservar horários na escala.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 self-end sm:self-center flex-shrink-0">
        <button
          type="button"
          role="switch"
          aria-checked={ocultarAtivo}
          disabled={salvando || !isFullAdmin}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            ocultarAtivo ? 'bg-purple-600' : 'bg-surface-600'
          } ${salvando || !isFullAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={
            ocultarAtivo
              ? 'Clique para exibir os nomes dos colegas na escala pública'
              : 'Clique para ocultar os nomes dos colegas na escala pública'
          }
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              ocultarAtivo ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  )
}

