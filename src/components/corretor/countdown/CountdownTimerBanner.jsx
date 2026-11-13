import { useMemo } from 'react'
import { Lock } from 'lucide-react'
import { useCountdown } from './useCountdown'
import CountdownBadge from './CountdownBadge'

/**
 * Formata a data alvo de abertura de forma concisa.
 * Ex: "Hoje às 14:00" ou "Sexta-feira, 13/11 às 00:42"
 */
function formatarDataAbertura(targetDate) {
  if (!targetDate) return ''
  try {
    const d = new Date(targetDate)
    if (isNaN(d.getTime())) return ''
    const agora = new Date()
    const mesmoDia =
      d.getDate() === agora.getDate() &&
      d.getMonth() === agora.getMonth() &&
      d.getFullYear() === agora.getFullYear()

    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    if (mesmoDia) {
      return `Hoje às ${hora}`
    }

    const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'long' })
    const dataCurta = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const diaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)
    return `${diaCapitalizado}, ${dataCurta} às ${hora}`
  } catch {
    return ''
  }
}

/**
 * CountdownTimerBanner — Banner compacto de contagem regressiva no topo da escala pública.
 * Texto resumido a no máximo 2 linhas diretas com contadores tabulares e altura reduzida.
 */
export default function CountdownTimerBanner({
  targetDate,
  onFinish,
  mensagemCustomizada,
}) {
  const { dias, horas, minutos, segundos, isFinalizado, totalSegundosRestantes } = useCountdown(
    targetDate,
    onFinish
  )

  const dataFormatada = useMemo(() => formatarDataAbertura(targetDate), [targetDate])

  if (isFinalizado) {
    return null
  }

  const faltamPoucosMinutos = totalSegundosRestantes <= 300 // <= 5 minutos

  return (
    <div className="card mb-3 border-brand-500/30 bg-gradient-to-r from-surface-800/95 via-surface-800/90 to-brand-950/20 dark:from-surface-800/95 dark:via-surface-800/90 dark:to-brand-950/30 p-2.5 sm:p-3 shadow-md shadow-brand-500/5 animate-fade-in relative overflow-hidden">
      {/* Brilho decorativo sutil */}
      <div className="absolute -top-8 -right-8 w-24 h-24 bg-brand-500/10 rounded-full blur-xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 relative z-10">
        {/* Linha 1 e Linha 2 de texto direto e limpo */}
        <div className="min-w-0 flex-1 text-center sm:text-left">
          {/* Linha 1: Status e Data de Abertura */}
          <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-brand-500/15 text-brand-600 dark:text-brand-300 border border-brand-500/25">
              <Lock className="w-2.5 h-2.5" />
              Abertura Programada
            </span>
            {dataFormatada && (
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                • {dataFormatada}
              </span>
            )}
          </div>

          {/* Linha 2: Instrução curta e direta */}
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-tight">
            {mensagemCustomizada || 'Consulte os turnos abaixo. As reservas serão liberadas automaticamente!'}
          </p>
        </div>

        {/* Badges de tempo compactos */}
        <div className="flex items-center justify-center gap-1 sm:gap-1.5 flex-shrink-0">
          {dias > 0 && (
            <>
              <CountdownBadge valor={dias} label="Dias" labelCurta="D" />
              <span className="text-gray-400 dark:text-gray-500 font-bold text-sm select-none pb-2">
                :
              </span>
            </>
          )}

          <CountdownBadge valor={horas} label="Horas" labelCurta="H" />
          <span className="text-gray-400 dark:text-gray-500 font-bold text-sm select-none pb-2">
            :
          </span>

          <CountdownBadge valor={minutos} label="Minutos" labelCurta="M" />
          <span className="text-gray-400 dark:text-gray-500 font-bold text-sm select-none pb-2">
            :
          </span>

          <CountdownBadge
            valor={segundos}
            label="Segundos"
            labelCurta="S"
            destaque={faltamPoucosMinutos}
          />
        </div>
      </div>
    </div>
  )
}
