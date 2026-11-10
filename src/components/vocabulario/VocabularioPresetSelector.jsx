import { useId } from 'react'
import {
  ChevronDown,
  Building2,
  Activity,
  Wine,
  ShoppingBag,
  HeartHandshake,
  Dumbbell,
  CalendarCheck,
  SlidersHorizontal,
} from 'lucide-react'
import { PRESETS_VOCABULARIO } from '../../lib/vocabularioHelper'

// Mapeamento dos ícones dinâmicos dos presets
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

/**
 * Seletor de segmento/nicho com ícone contextual e descrição explicativa.
 */
export default function VocabularioPresetSelector({
  presetSelecionado,
  onTrocaPreset,
  disabled = false,
}) {
  const selectId = useId()
  const PresetIcon = ICONS_MAP[PRESETS_VOCABULARIO[presetSelecionado]?.icone] || CalendarCheck

  return (
    <div className="mb-6">
      <label
        htmlFor={selectId}
        className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2"
      >
        Escolha o Segmento da sua Empresa
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-500">
          <PresetIcon className="w-5 h-5" />
        </div>
        <select
          id={selectId}
          value={presetSelecionado}
          onChange={(e) => onTrocaPreset(e.target.value)}
          disabled={disabled}
          className="w-full pl-11 pr-10 py-3 bg-surface-elevated border border-border rounded-xl text-text font-medium text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all appearance-none cursor-pointer disabled:opacity-50"
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
  )
}

