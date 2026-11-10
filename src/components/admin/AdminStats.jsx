export default function AdminStats({
  pontosCount = 0,
  termos = {},
  turnosCount = 0,
  reservasCount = 0,
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <div className="card text-center">
        <p className="text-2xl font-bold text-brand-400">{pontosCount}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{termos.pontos || 'Pontos'}</p>
      </div>
      <div className="card text-center">
        <p className="text-2xl font-bold text-neon-green">{turnosCount}</p>
        <p className="text-xs text-gray-500 mt-0.5">Turnos</p>
      </div>
      <div className="card text-center">
        <p className="text-2xl font-bold text-emerald-400">{reservasCount}</p>
        <p className="text-xs text-gray-500 mt-0.5">Reservas</p>
      </div>
    </div>
  )
}

