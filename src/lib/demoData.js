// ==============================================================================
// Dados e Estado Isolado da Escala Demonstrativa (Sandbox 100% Mock)
// Permite que visitantes experimentem o fluxo real sem tocar no banco Supabase.
// ==============================================================================

export const DEMO_EMPRESA = {
  id: 'demo-sandbox-empresa',
  nome: 'Plantão Modelo (Demonstração)',
  slug: 'demo',
  codigo_escala: 'demo',
  logo_url: null,
  cor_primaria: '#3b82f6',
  admin_pin: '1234',
  plano: 'pro',
  status: 'ativo',
  exigir_cadastro_previo: false,
  tipo_validacao_equipe: 'whatsapp',
  termos: {
    preset: 'imobiliaria',
  },
}

export const DEMO_PONTOS = [
  {
    id: 'ponto-shopping',
    empresa_id: DEMO_EMPRESA.id,
    nome: 'Stand Shopping Iguatemi',
    ordem: 1,
    ativo: true,
  },
  {
    id: 'ponto-jardins',
    empresa_id: DEMO_EMPRESA.id,
    nome: 'Plantão Jardins (Lançamento Residencial)',
    ordem: 2,
    ativo: true,
  },
  {
    id: 'ponto-centro',
    empresa_id: DEMO_EMPRESA.id,
    nome: 'Loja Conceito Centro',
    ordem: 3,
    ativo: true,
  },
]

export const DEMO_TURNOS = [
  // ─── Stand Shopping Iguatemi ──────────────────────────────
  {
    id: 'turno-shop-sab-1',
    empresa_id: DEMO_EMPRESA.id,
    ponto_id: 'ponto-shopping',
    dia: 'SÁBADO',
    horario: '09:00 às 13:00',
    capacidade: 2,
    ordem: 1,
  },
  {
    id: 'turno-shop-sab-2',
    empresa_id: DEMO_EMPRESA.id,
    ponto_id: 'ponto-shopping',
    dia: 'SÁBADO',
    horario: '13:00 às 17:00',
    capacidade: 2,
    ordem: 2,
  },
  {
    id: 'turno-shop-sab-3',
    empresa_id: DEMO_EMPRESA.id,
    ponto_id: 'ponto-shopping',
    dia: 'SÁBADO',
    horario: '17:00 às 21:00',
    capacidade: 2,
    ordem: 3,
  },
  {
    id: 'turno-shop-dom-1',
    empresa_id: DEMO_EMPRESA.id,
    ponto_id: 'ponto-shopping',
    dia: 'DOMINGO',
    horario: '10:00 às 14:00',
    capacidade: 2,
    ordem: 1,
  },
  {
    id: 'turno-shop-dom-2',
    empresa_id: DEMO_EMPRESA.id,
    ponto_id: 'ponto-shopping',
    dia: 'DOMINGO',
    horario: '14:00 às 18:00',
    capacidade: 2,
    ordem: 2,
  },
  {
    id: 'turno-shop-seg-1',
    empresa_id: DEMO_EMPRESA.id,
    ponto_id: 'ponto-shopping',
    dia: 'SEGUNDA-FEIRA',
    horario: '10:00 às 15:00',
    capacidade: 1,
    ordem: 1,
  },
  {
    id: 'turno-shop-seg-2',
    empresa_id: DEMO_EMPRESA.id,
    ponto_id: 'ponto-shopping',
    dia: 'SEGUNDA-FEIRA',
    horario: '15:00 às 20:00',
    capacidade: 1,
    ordem: 2,
  },

  // ─── Plantão Jardins (Lançamento Residencial) ────────────
  {
    id: 'turno-jar-sab-1',
    empresa_id: DEMO_EMPRESA.id,
    ponto_id: 'ponto-jardins',
    dia: 'SÁBADO',
    horario: '08:30 às 13:00',
    capacidade: 3,
    ordem: 1,
  },
  {
    id: 'turno-jar-sab-2',
    empresa_id: DEMO_EMPRESA.id,
    ponto_id: 'ponto-jardins',
    dia: 'SÁBADO',
    horario: '13:00 às 17:30',
    capacidade: 3,
    ordem: 2,
  },
  {
    id: 'turno-jar-dom-1',
    empresa_id: DEMO_EMPRESA.id,
    ponto_id: 'ponto-jardins',
    dia: 'DOMINGO',
    horario: '09:00 às 13:30',
    capacidade: 2,
    ordem: 1,
  },
  {
    id: 'turno-jar-dom-2',
    empresa_id: DEMO_EMPRESA.id,
    ponto_id: 'ponto-jardins',
    dia: 'DOMINGO',
    horario: '13:30 às 18:00',
    capacidade: 2,
    ordem: 2,
  },
  {
    id: 'turno-jar-sex-1',
    empresa_id: DEMO_EMPRESA.id,
    ponto_id: 'ponto-jardins',
    dia: 'SEXTA-FEIRA',
    horario: '09:00 às 13:30',
    capacidade: 2,
    ordem: 1,
  },
  {
    id: 'turno-jar-sex-2',
    empresa_id: DEMO_EMPRESA.id,
    ponto_id: 'ponto-jardins',
    dia: 'SEXTA-FEIRA',
    horario: '13:30 às 18:00',
    capacidade: 2,
    ordem: 2,
  },

  // ─── Loja Conceito Centro ─────────────────────────────────
  {
    id: 'turno-cen-sex-1',
    empresa_id: DEMO_EMPRESA.id,
    ponto_id: 'ponto-centro',
    dia: 'SEXTA-FEIRA',
    horario: '09:00 às 14:00',
    capacidade: 2,
    ordem: 1,
  },
  {
    id: 'turno-cen-sex-2',
    empresa_id: DEMO_EMPRESA.id,
    ponto_id: 'ponto-centro',
    dia: 'SEXTA-FEIRA',
    horario: '14:00 às 18:30',
    capacidade: 2,
    ordem: 2,
  },
  {
    id: 'turno-cen-sab-1',
    empresa_id: DEMO_EMPRESA.id,
    ponto_id: 'ponto-centro',
    dia: 'SÁBADO',
    horario: '09:00 às 13:00',
    capacidade: 2,
    ordem: 1,
  },
  {
    id: 'turno-cen-seg-1',
    empresa_id: DEMO_EMPRESA.id,
    ponto_id: 'ponto-centro',
    dia: 'SEGUNDA-FEIRA',
    horario: '09:00 às 14:00',
    capacidade: 2,
    ordem: 1,
  },
]

// Reservas pré-populadas com colegas para demonstrar vagas ocupadas, parciais e esgotadas
export const DEMO_RESERVAS_PADRAO = [
  {
    id: 'demo-res-1',
    empresa_id: DEMO_EMPRESA.id,
    turno_id: 'turno-shop-sab-1',
    corretor_nome: 'Lucas Mendonça',
    corretor_whatsapp: '(11) 98765-4321',
    device_id: 'colleague-mock-1',
    created_at: '2026-11-09T08:00:00.000Z',
  },
  {
    id: 'demo-res-2',
    empresa_id: DEMO_EMPRESA.id,
    turno_id: 'turno-shop-sab-2',
    corretor_nome: 'Camila Rocha',
    corretor_whatsapp: '(11) 97654-3210',
    device_id: 'colleague-mock-2',
    created_at: '2026-11-09T08:05:00.000Z',
  },
  {
    id: 'demo-res-3',
    empresa_id: DEMO_EMPRESA.id,
    turno_id: 'turno-shop-sab-2',
    corretor_nome: 'Rodrigo Silveira',
    corretor_whatsapp: '(11) 96543-2109',
    device_id: 'colleague-mock-3',
    created_at: '2026-11-09T08:10:00.000Z',
  },
  {
    id: 'demo-res-4',
    empresa_id: DEMO_EMPRESA.id,
    turno_id: 'turno-jar-sab-1',
    corretor_nome: 'Beatriz Ramos',
    corretor_whatsapp: '(11) 95432-1098',
    device_id: 'colleague-mock-4',
    created_at: '2026-11-09T08:15:00.000Z',
  },
  {
    id: 'demo-res-5',
    empresa_id: DEMO_EMPRESA.id,
    turno_id: 'turno-jar-sab-1',
    corretor_nome: 'Juliana Costa',
    corretor_whatsapp: '(11) 94321-0987',
    device_id: 'colleague-mock-5',
    created_at: '2026-11-09T08:20:00.000Z',
  },
  {
    id: 'demo-res-6',
    empresa_id: DEMO_EMPRESA.id,
    turno_id: 'turno-shop-dom-1',
    corretor_nome: 'Fernando Dias',
    corretor_whatsapp: '(11) 93210-9876',
    device_id: 'colleague-mock-6',
    created_at: '2026-11-09T08:25:00.000Z',
  },
  {
    id: 'demo-res-7',
    empresa_id: DEMO_EMPRESA.id,
    turno_id: 'turno-cen-seg-1',
    corretor_nome: 'Larissa Carvalho',
    corretor_whatsapp: '(11) 92109-8765',
    device_id: 'colleague-mock-7',
    created_at: '2026-11-09T08:30:00.000Z',
  },
]

const STORAGE_KEY_DEMO_RESERVAS = 'escala_demo_sandbox_reservas'

/**
 * Carrega as reservas da demo do localStorage ou inicializa com o padrão
 */
export function carregarReservasDemo() {
  if (typeof window === 'undefined') return [...DEMO_RESERVAS_PADRAO]
  try {
    const salvo = localStorage.getItem(STORAGE_KEY_DEMO_RESERVAS)
    if (salvo) {
      const parsed = JSON.parse(salvo)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch (err) {
    console.error('Erro ao ler reservas demo do localStorage:', err)
  }
  return [...DEMO_RESERVAS_PADRAO]
}

/**
 * Salva a lista de reservas da demo no localStorage
 */
export function salvarReservasDemo(reservas) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY_DEMO_RESERVAS, JSON.stringify(reservas))
  } catch (err) {
    console.error('Erro ao salvar reservas demo no localStorage:', err)
  }
}

/**
 * Restaura as reservas da demonstração para o estado inicial
 */
export function resetarReservasDemo() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_DEMO_RESERVAS, JSON.stringify(DEMO_RESERVAS_PADRAO))
    } catch {}
  }
  return [...DEMO_RESERVAS_PADRAO]
}

