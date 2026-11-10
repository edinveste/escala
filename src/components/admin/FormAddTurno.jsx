import { useState, useCallback } from 'react'
import { Plus, MapPin, Calendar, Clock, Users, ChevronDown } from 'lucide-react'
import { DIAS_SEMANA, formatarNomeDia } from '../../lib/diasSemana'
import { supabase } from '../../lib/supabaseClient'

const DIAS_OPCOES = DIAS_SEMANA

export default function FormAddTurno({
  pontos = [],
  turnos = [],
  empresaId,
  termos = {},
  onDataChanged,
  showToast,
  onIrPontos,
}) {
  const STORAGE_KEY_FORM_DIA = empresaId
    ? `escala_admin_ultimo_dia_${empresaId}`
    : 'escala_admin_ultimo_dia'

  const [formPontoId, setFormPontoId] = useState('')
  const [formDia, setFormDia] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_FORM_DIA)
      if (salvo) {
        const norm = formatarNomeDia(salvo)
        if (DIAS_OPCOES.includes(norm)) {
          return norm
        }
      }
    } catch (err) {
      console.error('Erro ao ler preferência de dia:', err)
    }
    return 'SEGUNDA-FEIRA'
  })
  const [formHorario, setFormHorario] = useState('')
  const [formCapacidade, setFormCapacidade] = useState(3)
  const [addingTurno, setAddingTurno] = useState(false)

  const handleDiaChange = (e) => {
    const novoDia = formatarNomeDia(e.target.value)
    setFormDia(novoDia)
    try {
      localStorage.setItem(STORAGE_KEY_FORM_DIA, novoDia)
    } catch (err) {
      console.error('Erro ao salvar preferência de dia:', err)
    }
  }

  const handleAddTurno = useCallback(
    async (e) => {
      e.preventDefault()

      if (!formPontoId) {
        showToast?.('Selecione um ponto de captação.', 'error')
        return
      }
      if (!formHorario.trim()) {
        showToast?.('Preencha o horário.', 'error')
        return
      }

      setAddingTurno(true)
      try {
        const diaNorm = formatarNomeDia(formDia)
        const turnosMesmoDia = turnos.filter(
          (t) => t.ponto_id === formPontoId && formatarNomeDia(t.dia) === diaNorm
        )
        const proximaOrdem =
          turnosMesmoDia.length > 0
            ? Math.max(...turnosMesmoDia.map((t) => (Number.isFinite(t.ordem) ? t.ordem : 0))) + 1
            : 0

        const { error } = await supabase.from('turnos').insert({
          ponto_id: formPontoId,
          dia: diaNorm,
          horario: formHorario.trim(),
          capacidade: Math.max(1, formCapacidade),
          ordem: proximaOrdem,
          ...(empresaId ? { empresa_id: empresaId } : {}),
        })

        if (error) throw error

        showToast?.('Turno adicionado com sucesso! ✅', 'success')
        setFormHorario('')
        onDataChanged?.()
      } catch (err) {
        console.error('Erro ao adicionar turno:', err)
        showToast?.('Erro ao adicionar turno.', 'error')
      } finally {
        setAddingTurno(false)
      }
    },
    [formPontoId, formDia, formHorario, formCapacidade, turnos, empresaId, onDataChanged, showToast]
  )

  const pontoLabel = termos.ponto || 'Ponto de Captação'

  return (
    <div className="card">
      <h2 className="text-base font-bold text-gray-200 mb-4 flex items-center gap-2">
        <Plus className="w-5 h-5 text-brand-400" />
        Adicionar Turno
      </h2>

      {pontos.length === 0 ? (
        <div className="text-center py-6 space-y-2">
          <p className="text-sm text-gray-500">
            Crie um {pontoLabel.toLowerCase()} primeiro para adicionar turnos.
          </p>
          {onIrPontos && (
            <button
              type="button"
              onClick={onIrPontos}
              className="text-xs font-semibold text-brand-400 hover:text-brand-300 underline"
            >
              Ir para Gestão de {termos.pontos || 'Pontos'} →
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleAddTurno} className="space-y-3">
          {/* Ponto */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {pontoLabel}
            </label>
            <div className="relative">
              <select
                value={formPontoId}
                onChange={(e) => setFormPontoId(e.target.value)}
                className="input-field appearance-none pr-10"
              >
                <option value="">Selecione um ponto...</option>
                {pontos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Dia */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Dia
            </label>
            <div className="relative">
              <select
                value={formDia}
                onChange={handleDiaChange}
                className="input-field appearance-none pr-10"
              >
                {DIAS_OPCOES.map((dia) => (
                  <option key={dia} value={dia}>
                    {dia}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Horário */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Horário
            </label>
            <input
              type="text"
              value={formHorario}
              onChange={(e) => setFormHorario(e.target.value)}
              placeholder="Ex: 14h às 16h"
              className="input-field"
            />
          </div>

          {/* Capacidade */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Capacidade de vagas neste horário
            </label>
            <input
              type="number"
              value={formCapacidade}
              onChange={(e) => setFormCapacidade(parseInt(e.target.value, 10) || 1)}
              min={1}
              max={50}
              className="input-field"
              placeholder="Ex: 2 ou 3 vagas"
            />
          </div>

          <button
            type="submit"
            disabled={addingTurno}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {addingTurno ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Adicionando...
              </>
            ) : (
              <>
                <Plus className="w-4.5 h-4.5" />
                Adicionar Turno
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}

