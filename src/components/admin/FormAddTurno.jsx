import { useState, useCallback } from 'react'
import { Plus, MapPin, Calendar, Clock, Users, ChevronDown, Pencil, RotateCcw } from 'lucide-react'
import { DIAS_SEMANA, formatarNomeDia } from '../../lib/diasSemana'
import { supabase } from '../../lib/supabaseClient'
import { isMissingColumnError } from '../../lib/supabasePublicHelper'
import {
  formatarHorarioTurno,
  normalizarTimeSql,
  cruzaMeiaNoite,
} from '../../lib/horarioHelper'

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
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFim, setHoraFim] = useState('')
  const [personalizarTexto, setPersonalizarTexto] = useState(false)
  const [formHorarioCustom, setFormHorarioCustom] = useState('')
  const [formCapacidade, setFormCapacidade] = useState(3)
  const [addingTurno, setAddingTurno] = useState(false)

  const horarioGerado = formatarHorarioTurno(horaInicio, horaFim)
  const horarioFinal = personalizarTexto
    ? formHorarioCustom.trim() || horarioGerado
    : horarioGerado
  const horasIguais = Boolean(horaInicio && horaFim && horaInicio === horaFim)
  const viraMadrugada = Boolean(horaInicio && horaFim && !horasIguais && cruzaMeiaNoite(horaInicio, horaFim))

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
      if (!horaInicio || !horaFim) {
        showToast?.('Selecione a hora de início e de fim do turno.', 'error')
        return
      }
      if (horaInicio === horaFim) {
        showToast?.('A hora de fim deve ser diferente da hora de início.', 'warning')
        return
      }
      if (!horarioFinal) {
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

        const basePayload = {
          ponto_id: formPontoId,
          dia: diaNorm,
          horario: horarioFinal,
          capacidade: Math.max(1, formCapacidade),
          ordem: proximaOrdem,
          ...(empresaId ? { empresa_id: empresaId } : {}),
        }

        const payloadComHoras = {
          ...basePayload,
          hora_inicio: normalizarTimeSql(horaInicio),
          hora_fim: normalizarTimeSql(horaFim),
        }

        let { error } = await supabase.from('turnos').insert(payloadComHoras)
        if (error && isMissingColumnError(error)) {
          const fallbackRes = await supabase.from('turnos').insert(basePayload)
          error = fallbackRes.error
        }

        if (error) throw error

        showToast?.('Turno adicionado com sucesso! ✅', 'success')
        setHoraInicio('')
        setHoraFim('')
        setFormHorarioCustom('')
        setPersonalizarTexto(false)
        onDataChanged?.()
      } catch (err) {
        console.error('Erro ao adicionar turno:', err)
        showToast?.('Erro ao adicionar turno.', 'error')
      } finally {
        setAddingTurno(false)
      }
    },
    [
      formPontoId,
      formDia,
      horaInicio,
      horaFim,
      horarioFinal,
      formCapacidade,
      turnos,
      empresaId,
      onDataChanged,
      showToast,
    ]
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

          {/* Hora Início e Hora Fim (Mobile-First) */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Hora Início
                </label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="input-field text-sm sm:text-base font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Hora Fim
                </label>
                <input
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  className="input-field text-sm sm:text-base font-medium"
                  required
                />
              </div>
            </div>

            {horasIguais && (
              <p className="text-[11px] text-red-500 dark:text-red-400 font-medium">
                A hora de fim deve ser diferente da hora de início.
              </p>
            )}

            {viraMadrugada && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                Turno noturno: encerra às {horaFim} (virada de madrugada).
              </p>
            )}

            {/* Prévia do texto gerado + opção de personalização */}
            {(horarioGerado || personalizarTexto) && (
              <div className="pt-0.5">
                {personalizarTexto ? (
                  <div className="space-y-1.5 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium text-gray-400">
                        Texto exibido na escala
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setPersonalizarTexto(false)
                          setFormHorarioCustom('')
                        }}
                        className="text-[11px] text-brand-500 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Usar automático
                      </button>
                    </div>
                    <input
                      type="text"
                      value={formHorarioCustom}
                      onChange={(e) => setFormHorarioCustom(e.target.value)}
                      placeholder={horarioGerado || 'Ex: 08:00 às 12:00 (Manhã)'}
                      className="input-field text-sm py-2.5"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-gray-500 px-0.5">
                    <span>
                      Exibição: <strong className="text-gray-300">{horarioGerado}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setFormHorarioCustom(horarioGerado)
                        setPersonalizarTexto(true)
                      }}
                      className="text-brand-500 dark:text-brand-400 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      <Pencil className="w-3 h-3" />
                      Personalizar rótulo
                    </button>
                  </div>
                )}
              </div>
            )}
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
            disabled={addingTurno || horasIguais}
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
