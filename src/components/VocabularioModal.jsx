import { useState, useId } from 'react'
import { supabase } from '../lib/supabaseClient'
import { PRESETS_VOCABULARIO, obterTermos } from '../lib/vocabularioHelper'
import {
  X,
  Sparkles,
  Building2,
  Activity,
  Wine,
  ShoppingBag,
  HeartHandshake,
  Dumbbell,
  CalendarCheck,
  SlidersHorizontal,
  Check,
  Eye,
  ChevronDown,
  Save,
} from 'lucide-react'

// Mapa de ícones
const ICONS_MAP = {
  Building2,
  Activity,
  Wine,
  ShoppingBag,
  HeartHandshake,
  Dumbbell,
  CalendarCheck,
  SlidersHorizontal,
}

export default function VocabularioModal({
  isOpen,
  onClose,
  empresa,
  onUpdateEmpresa,
  showToast,
}) {
  const selectId = useId()
  const termosAtuais = obterTermos(empresa)

  const [presetSelecionado, setPresetSelecionado] = useState(
    () => empresa?.termos?.preset || 'generico'
  )
  const [modoCustomizado, setModoCustomizado] = useState(
    () => presetSelecionado === 'personalizado' || Boolean(empresa?.termos?.customizado)
  )

  // Campos customizáveis
  const [ponto, setPonto] = useState(() => termosAtuais.ponto)
  const [pontos, setPontos] = useState(() => termosAtuais.pontos)
  const [pessoa, setPessoa] = useState(() => termosAtuais.pessoa)
  const [pessoas, setPessoas] = useState(() => termosAtuais.pessoas)
  const [tituloEscala, setTituloEscala] = useState(() => termosAtuais.tituloEscala)
  const [acaoVaga, setAcaoVaga] = useState(() => termosAtuais.acaoVaga)
  const [acaoCancelar, setAcaoCancelar] = useState(() => termosAtuais.acaoCancelar)

  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  // Ao trocar de preset no dropdown
  const handleTrocaPreset = (presetKey) => {
    setPresetSelecionado(presetKey)
    const preset = PRESETS_VOCABULARIO[presetKey]
    if (preset) {
      setPonto(preset.termos.ponto)
      setPontos(preset.termos.pontos)
      setPessoa(preset.termos.pessoa)
      setPessoas(preset.termos.pessoas)
      setTituloEscala(preset.termos.tituloEscala)
      setAcaoVaga(preset.termos.acaoVaga)
      setAcaoCancelar(preset.termos.acaoCancelar)
      if (presetKey === 'personalizado') {
        setModoCustomizado(true)
      }
    }
  }

  const handleSalvar = async () => {
    if (!empresa?.id) return

    setSaving(true)
    try {
      const payloadTermos = {
        preset: presetSelecionado,
        customizado: modoCustomizado,
        ponto: ponto.trim() || 'Ponto de Escala',
        pontos: pontos.trim() || 'Pontos de Escala',
        pessoa: pessoa.trim() || 'Colaborador(a)',
        pessoas: pessoas.trim() || 'Equipe',
        tituloEscala: tituloEscala.trim() || 'Gestão de Escalas',
        subtitulo: `Selecione seu horário e garanta sua vaga`,
        acaoVaga: acaoVaga.trim() || 'Garantir Vaga',
        acaoCancelar: acaoCancelar.trim() || 'Cancelar Minha Vaga',
        textoWhatsapp: `📋 ${tituloEscala.toUpperCase()}`,
        equipeAutorizada: `Equipe de ${pessoas.trim() || 'Membros'}`,
        artigoPonto: 'o',
        artigoPessoa: 'o',
      }

      // 1. Tenta atualizar direto na tabela
      const { error: updateErr } = await supabase
        .from('empresas')
        .update({ termos: payloadTermos })
        .eq('id', empresa.id)

      if (updateErr) {
        // Fallback: RPC atualizar_termos_empresa
        const { error: rpcErr } = await supabase.rpc('atualizar_termos_empresa', {
          p_empresa_id: empresa.id,
          p_termos: payloadTermos,
        })
        if (rpcErr) throw rpcErr
      }

      // Atualiza estado local imediatamente
      if (onUpdateEmpresa) {
        onUpdateEmpresa({ ...empresa, termos: payloadTermos })
      }

      showToast?.('Vocabulário do nicho atualizado com sucesso!', 'success')
      onClose()
    } catch (err) {
      console.error('Erro ao salvar termos:', err)
      showToast?.('Erro ao salvar termos: ' + (err.message || err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const PresetIcon = ICONS_MAP[PRESETS_VOCABULARIO[presetSelecionado]?.icone] || CalendarCheck

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="card max-w-xl w-full max-h-[90vh] overflow-y-auto border border-border/80 shadow-2xl p-6 sm:p-7 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-text-muted hover:text-text rounded-lg hover:bg-surface-elevated transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text">Nicho & Vocabulário</h2>
            <p className="text-xs sm:text-sm text-text-muted">
              Adapte os nomes da plataforma para a linguagem da sua equipe e segmento
            </p>
          </div>
        </div>

        {/* Seletor de Preset */}
        <div className="mb-6">
          <label htmlFor={selectId} className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            Escolha o Segmento da sua Empresa
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-500">
              <PresetIcon className="w-5 h-5" />
            </div>
            <select
              id={selectId}
              value={presetSelecionado}
              onChange={(e) => handleTrocaPreset(e.target.value)}
              className="w-full pl-11 pr-10 py-3 bg-surface-elevated border border-border rounded-xl text-text font-medium text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all appearance-none cursor-pointer"
            >
              {Object.values(PRESETS_VOCABULARIO).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-text-muted">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xs text-text-muted mt-1.5 pl-1">
            {PRESETS_VOCABULARIO[presetSelecionado]?.descricao}
          </p>
        </div>

        {/* Card de Pré-visualização ao Vivo */}
        <div className="mb-6 p-4 rounded-xl bg-surface-elevated/70 border border-border/80">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-brand-500" /> Como sua equipe verá no celular:
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-500 font-medium">
              Ao Vivo
            </span>
          </div>

          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-text-muted">Título da Escala:</span>
              <span className="font-semibold text-text">{tituloEscala || '—'}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-text-muted">Seus Locais / Unidades:</span>
              <span className="font-semibold text-brand-400">{pontos || '—'}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-text-muted">Identificação da Pessoa:</span>
              <span className="font-semibold text-text">{pessoa || '—'}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/40">
              <span className="text-text-muted">Sua Equipe / Grupo:</span>
              <span className="font-semibold text-text">{pessoas || '—'}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-text-muted">Botão de Confirmação:</span>
              <span className="px-2.5 py-1 rounded bg-brand-500 text-white font-medium text-xs">
                {acaoVaga || 'Garantir Vaga'}
              </span>
            </div>
          </div>
        </div>

        {/* Toggle para Ajuste Fino / Personalização Manual */}
        <div className="mb-5">
          <button
            type="button"
            onClick={() => setModoCustomizado(!modoCustomizado)}
            className="flex items-center gap-2 text-xs font-medium text-brand-500 hover:text-brand-400 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>
              {modoCustomizado
                ? 'Ocultar campos personalizados'
                : 'Quer ajustar as palavras manualmente? Clique aqui'}
            </span>
          </button>
        </div>

        {/* Campos Manuais (Exibidos se modoCustomizado === true) */}
        {modoCustomizado && (
          <div className="space-y-3.5 mb-6 p-4 rounded-xl bg-surface border border-border/60 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Local no Singular (ex: Stand, Ala, Loja)
                </label>
                <input
                  type="text"
                  value={ponto}
                  onChange={(e) => setPonto(e.target.value)}
                  placeholder="ex: Ponto de Escala"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Locais no Plural (ex: Stands, Alas, Lojas)
                </label>
                <input
                  type="text"
                  value={pontos}
                  onChange={(e) => setPontos(e.target.value)}
                  placeholder="ex: Pontos de Escala"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Pessoa no Singular (ex: Corretor, Médico, Freela)
                </label>
                <input
                  type="text"
                  value={pessoa}
                  onChange={(e) => setPessoa(e.target.value)}
                  placeholder="ex: Colaborador(a)"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Pessoas no Plural (ex: Corretores, Plantonistas)
                </label>
                <input
                  type="text"
                  value={pessoas}
                  onChange={(e) => setPessoas(e.target.value)}
                  placeholder="ex: Equipe"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Título Geral da Escala (ex: Controle de Plantões)
              </label>
              <input
                type="text"
                value={tituloEscala}
                onChange={(e) => setTituloEscala(e.target.value)}
                placeholder="ex: Gestão de Escalas"
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Texto do Botão de Reserva
                </label>
                <input
                  type="text"
                  value={acaoVaga}
                  onChange={(e) => setAcaoVaga(e.target.value)}
                  placeholder="ex: Garantir Vaga"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Texto do Botão de Cancelamento
                </label>
                <input
                  type="text"
                  value={acaoCancelar}
                  onChange={(e) => setAcaoCancelar(e.target.value)}
                  placeholder="ex: Cancelar Minha Vaga"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl border border-border text-xs sm:text-sm font-medium text-text-muted hover:text-text hover:bg-surface-elevated transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium text-xs sm:text-sm transition-all shadow-md shadow-brand-500/20 flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <>Salvando...</>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salvar Vocabulário</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

