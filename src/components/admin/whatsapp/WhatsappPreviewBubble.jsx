import { useMemo } from 'react'
import { CheckCheck } from 'lucide-react'

/**
 * Converte marcações simples do WhatsApp (*negrito*, _itálico_, ~tachado~) em elementos JSX.
 */
function formatarTextoZap(texto) {
  if (!texto) return null

  // Divide por linhas preservando espaçamento
  const linhas = texto.split('\n')

  return linhas.map((linha, linhaIdx) => {
    // Processa negrito (*palavra*)
    const partes = linha.split(/(\*[^*]+\*|_[^_]+_|~[^~]+~)/g)

    return (
      <span key={linhaIdx} className="block min-h-[1.25rem]">
        {partes.map((parte, idx) => {
          if (parte.startsWith('*') && parte.endsWith('*') && parte.length > 2) {
            return (
              <strong key={idx} className="font-bold text-gray-100 dark:text-white">
                {parte.slice(1, -1)}
              </strong>
            )
          }
          if (parte.startsWith('_') && parte.endsWith('_') && parte.length > 2) {
            return (
              <em key={idx} className="italic text-gray-300 dark:text-gray-200">
                {parte.slice(1, -1)}
              </em>
            )
          }
          if (parte.startsWith('~') && parte.endsWith('~') && parte.length > 2) {
            return (
              <span key={idx} className="line-through text-gray-400">
                {parte.slice(1, -1)}
              </span>
            )
          }
          return <span key={idx}>{parte}</span>
        })}
      </span>
    )
  })
}

/**
 * Componente que simula a bolha de mensagem enviada no WhatsApp.
 */
export default function WhatsappPreviewBubble({ texto = '', horaEnvio = '12:00' }) {
  const conteudoFormatado = useMemo(() => formatarTextoZap(texto), [texto])

  if (!texto || !texto.trim()) {
    return (
      <div className="p-4 rounded-xl bg-surface-900/60 border border-surface-700/60 text-center text-xs text-gray-400 italic">
        Nenhum texto preenchido ainda. Digite acima para ver a prévia ao vivo da mensagem no WhatsApp.
      </div>
    )
  }

  return (
    <div className="w-full rounded-2xl p-3 sm:p-4 bg-[#0c1317] border border-surface-700/60 shadow-inner select-text">
      <div className="text-[11px] font-semibold text-emerald-400/90 mb-2 flex items-center gap-1.5 select-none">
        <span>💬 Prévia no WhatsApp</span>
        <span className="text-gray-500">•</span>
        <span className="text-gray-400 font-normal">Como a equipe verá a mensagem</span>
      </div>

      {/* Bolha do WhatsApp */}
      <div className="flex justify-end">
        <div className="max-w-[95%] sm:max-w-[88%] rounded-2xl rounded-tr-sm bg-[#005c4b] text-gray-100 px-3.5 py-2.5 shadow-md relative text-xs sm:text-[13px] leading-relaxed break-words font-sans">
          <div className="whitespace-pre-wrap">{conteudoFormatado}</div>

          <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-200/70 mt-1 select-none">
            <span>{horaEnvio}</span>
            <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
          </div>
        </div>
      </div>
    </div>
  )
}

