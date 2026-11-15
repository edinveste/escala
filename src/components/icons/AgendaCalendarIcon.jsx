/**
 * AgendaCalendarIcon — Ícone de calendário profissional e refinado para a agenda/horários.
 * Apresenta folha moderna com profundidade estética, anéis de fixação superiores
 * e marcadores nítidos de dias e compromissos.
 */
export default function AgendaCalendarIcon({ className = 'w-4 h-4', ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Fundo sutil do corpo para dar volume e profundidade */}
      <rect
        x="3"
        y="4"
        width="18"
        height="17"
        rx="3"
        fill="currentColor"
        fillOpacity="0.14"
      />
      {/* Contorno externo estrutural */}
      <rect
        x="3"
        y="4"
        width="18"
        height="17"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Linha divisória da barra de cabeçalho */}
      <path
        d="M3 9.5H21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Pinos metálicos de fixação superior */}
      <path
        d="M8 2V5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16 2V5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Grade de dias agendados com cantos suaves */}
      <rect x="7" y="12" width="2.2" height="2.2" rx="0.6" fill="currentColor" />
      <rect x="10.9" y="12" width="2.2" height="2.2" rx="0.6" fill="currentColor" />
      <rect x="14.8" y="12" width="2.2" height="2.2" rx="0.6" fill="currentColor" />
      <rect x="7" y="15.8" width="2.2" height="2.2" rx="0.6" fill="currentColor" />
      <rect x="10.9" y="15.8" width="2.2" height="2.2" rx="0.6" fill="currentColor" />
      <rect x="14.8" y="15.8" width="2.2" height="2.2" rx="0.6" fill="currentColor" fillOpacity="0.5" />
    </svg>
  )
}
