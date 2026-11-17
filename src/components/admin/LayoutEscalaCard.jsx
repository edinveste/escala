import { useState } from 'react'
import { LayoutGrid, Sparkles, SlidersHorizontal, Check } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

/**
 * LayoutEscalaCard — Controle de Modelo Visual da Escala Pública nas Configurações.
 * Permite que o gestor escolha entre:
 * - 'moderno': Layout rico com branding, busca, barra de métricas, progresso de vagas e agenda.
 * - 'classico': Layout original enxuto e minimalista preservado integralmente.
 */
export default function LayoutEscalaCard({
  empresa,
  onEmpresaUpdated,
  showToast,
  isFullAdmin = true,
  termos = {},
}) {
  const [salvando, setSalvando] = useState(false)

  if (!isFullAdmin) return null

  const layoutAtual =
    empresa?.termos?.layout_pontos ||
    termos?.layout_pontos ||
    empresa?.layout_pontos ||
    (typeof window !== 'undefined' && empresa?.id
      ? localStorage.getItem('escala_layout_' + empresa.id)
      : null) ||
    'moderno'

  const handleSelecionarLayout = async (novoLayout) => {
    if (novoLayout === layoutAtual || salvando) return

    setSalvando(true)
    try {
      // 1. Salva no localStorage localmente para efeito imediato nesta máquina
      if (empresa?.id && typeof window !== 'undefined') {
        try {
          localStorage.setItem('escala_layout_' + empresa.id, novoLayout)
        } catch {}
      }

      const novosTermos = {
        ...(empresa?.termos || {}),
        layout_pontos: novoLayout,
      }

      let sucesso = false

      // 2. Tenta via RPC oficial atualizar_termos_empresa (SECURITY DEFINER com validação de admin)
      try {
        const { error: rpcErr } = await supabase.rpc('atualizar_termos_empresa', {
          p_empresa_id: empresa.id,
          p_termos: novosTermos,
        })
        if (!rpcErr) {
          sucesso = true
        } else {
          console.warn('RPC atualizar_termos_empresa falhou:', rpcErr)
        }
      } catch (errRpc) {
        console.warn('Exceção ao chamar atualizar_termos_empresa:', errRpc)
      }

      // 3. Fallback: update direto no campo JSONB termos da tabela empresas
      if (!sucesso) {
        const { error: errFallback } = await supabase
          .from('empresas')
          .update({ termos: novosTermos })
          .eq('id', empresa.id)

        if (!errFallback) {
          sucesso = true
        } else {
          console.warn('Update direto em empresas.termos falhou:', errFallback)
        }
      }

      if (!sucesso) {
        throw new Error('Não foi possível persistir a alteração no banco de dados.')
      }

      onEmpresaUpdated?.({
        ...empresa,
        layout_pontos: novoLayout,
        termos: novosTermos,
      })

      showToast?.(
        novoLayout === 'moderno'
          ? 'Layout Moderno ativado na escala pública! 🚀'
          : 'Layout Clássico ativado na escala pública! 📋',
        'success'
      )
    } catch (err) {
      console.error('Erro ao alternar layout da escala:', err)
      showToast?.('Erro ao salvar modelo visual: ' + (err.message || err), 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="card space-y-3.5 bg-surface-800/90 border-surface-600">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl border border-brand-500/25 bg-brand-500/10 text-brand-400 flex-shrink-0">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-gray-200">
                Modelo Visual da Escala
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/30">
                {layoutAtual === 'moderno' ? 'Moderno Ativo' : 'Clássico Ativo'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Escolha como a lista de {termos.pontos?.toLowerCase() || 'locais'} será exibida aos colaboradores.
            </p>
          </div>
        </div>
      </div>

      {/* Opções de Layout (Seleção em Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {/* Opção 1: Moderno */}
        <button
          type="button"
          disabled={salvando}
          onClick={() => handleSelecionarLayout('moderno')}
          className={`relative text-left p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-2.5 ${
            layoutAtual === 'moderno'
              ? 'bg-brand-500/10 border-brand-500/50 shadow-sm ring-1 ring-brand-500/30'
              : 'bg-surface-700/40 hover:bg-surface-700/70 border-surface-600/70 text-gray-400'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-gray-100">
              <Sparkles className="w-4 h-4 text-brand-400" />
              <span>Moderno & Completo</span>
            </div>
            {layoutAtual === 'moderno' && (
              <span className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <Check className="w-3 h-3 stroke-[3]" />
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Visual moderno com branding oficial, busca instantânea, barra de métricas, progresso de vagas e agenda em destaque.
          </p>
        </button>

        {/* Opção 2: Clássico */}
        <button
          type="button"
          disabled={salvando}
          onClick={() => handleSelecionarLayout('classico')}
          className={`relative text-left p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-2.5 ${
            layoutAtual === 'classico'
              ? 'bg-brand-500/10 border-brand-500/50 shadow-sm ring-1 ring-brand-500/30'
              : 'bg-surface-700/40 hover:bg-surface-700/70 border-surface-600/70 text-gray-400'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-gray-100">
              <SlidersHorizontal className="w-4 h-4 text-gray-400" />
              <span>Clássico & Minimalista</span>
            </div>
            {layoutAtual === 'classico' && (
              <span className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <Check className="w-3 h-3 stroke-[3]" />
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Layout original enxuto e minimalista preservado integralmente, com foco direto na lista simples de pontos.
          </p>
        </button>
      </div>
    </div>
  )
}
