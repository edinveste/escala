import React from 'react'

/**
 * CountdownBadge — Mini card de unidade temporal com números monoespaçados tabulares.
 * Formato compacto e proporcional para manter o banner enxuto.
 */
export default function CountdownBadge({
  valor = 0,
  label = '',
  labelCurta = '',
  destaque = false,
}) {
  const valorFormatado = String(Math.max(0, valor)).padStart(2, '0')

  return (
    <div
      className={`flex flex-col items-center justify-center min-w-[44px] sm:min-w-[50px] px-1.5 py-1 rounded-lg border transition-all select-none ${
        destaque
          ? 'bg-brand-500/15 border-brand-500/40 text-brand-600 dark:text-brand-300 shadow-sm shadow-brand-500/10'
          : 'bg-surface-800/90 dark:bg-surface-700/90 border-surface-600/60 dark:border-surface-600/80 text-gray-800 dark:text-gray-100'
      }`}
    >
      <span className="font-mono text-base sm:text-lg font-black tabular-nums tracking-tight leading-none">
        {valorFormatado}
      </span>
      <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-0.5 leading-none">
        <span className="hidden sm:inline">{label}</span>
        <span className="inline sm:hidden">{labelCurta || label}</span>
      </span>
    </div>
  )
}
