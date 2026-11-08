// ==============================================================================
// Vocabulário & Nichos Dinâmicos (White-Label de Termos) - EscalaFácil
// Permite que qualquer empresa personalize os termos da interface para o seu
// segmento específico (Imobiliárias, Saúde, Eventos, Varejo, Igrejas, etc.)
// ==============================================================================

export const PRESETS_VOCABULARIO = {
  generico: {
    id: 'generico',
    nome: 'Geral / Universal (Padrão)',
    descricao: 'Ideal para qualquer tipo de negócio, equipe ou prestador de serviço',
    icone: 'CalendarCheck',
    termos: {
      ponto: 'Ponto de Escala',
      pontos: 'Pontos de Escala',
      pessoa: 'Colaborador(a)',
      pessoas: 'Equipe',
      tituloEscala: 'Gestão de Escalas & Vagas',
      subtitulo: 'Selecione e garanta seus horários na escala em tempo real',
      acaoVaga: 'Garantir Vaga',
      acaoCancelar: 'Cancelar Minha Vaga',
      textoWhatsapp: '📋 ESCALA SEMANAL',
      equipeAutorizada: 'Equipe Autorizada',
      artigoPonto: 'o', // o Ponto
      artigoPessoa: 'o', // o Colaborador
    },
  },
  imobiliaria: {
    id: 'imobiliaria',
    nome: 'Imobiliárias & Construtoras',
    descricao: 'Stands de vendas, pontos de captação e plantões de corretores',
    icone: 'Building2',
    termos: {
      ponto: 'Ponto de Captação',
      pontos: 'Pontos de Captação',
      pessoa: 'Corretor(a)',
      pessoas: 'Corretores',
      tituloEscala: 'Controle de Captação',
      subtitulo: 'Selecione o ponto e garanta seu horário de plantão',
      acaoVaga: 'Garantir Vaga',
      acaoCancelar: 'Cancelar Minha Vaga',
      textoWhatsapp: '📋 ESCALA DE CAPTAÇÃO',
      equipeAutorizada: 'Equipe de Corretores',
      artigoPonto: 'o',
      artigoPessoa: 'o',
    },
  },
  saude: {
    id: 'saude',
    nome: 'Saúde, Clínicas & Home Care',
    descricao: 'Plantões de médicos, enfermeiros, técnicos e cuidadores',
    icone: 'Activity',
    termos: {
      ponto: 'Ala / Posto',
      pontos: 'Alas / Postos de Plantão',
      pessoa: 'Plantonista',
      pessoas: 'Plantonistas',
      tituloEscala: 'Escala de Plantões',
      subtitulo: 'Selecione a unidade e assuma seu plantão',
      acaoVaga: 'Assumir Plantão',
      acaoCancelar: 'Liberar Plantão',
      textoWhatsapp: '📋 ESCALA DE PLANTÃO',
      equipeAutorizada: 'Corpo Clínico Autorizado',
      artigoPonto: 'a',
      artigoPessoa: 'o',
    },
  },
  eventos: {
    id: 'eventos',
    nome: 'Eventos, Bares & Buffets',
    descricao: 'Garçons, barmans, recepcionistas, seguranças e freelas',
    icone: 'Wine',
    termos: {
      ponto: 'Setor / Bar / Festa',
      pontos: 'Setores do Evento',
      pessoa: 'Freela / Staff',
      pessoas: 'Equipe de Apoio',
      tituloEscala: 'Escala de Apoio & Eventos',
      subtitulo: 'Confirme sua vaga de trabalho no evento',
      acaoVaga: 'Confirmar Presença',
      acaoCancelar: 'Cancelar Presença',
      textoWhatsapp: '📋 ESCALA DO EVENTO',
      equipeAutorizada: 'Equipe de Freelas Cadastrada',
      artigoPonto: 'o',
      artigoPessoa: 'o',
    },
  },
  promotores: {
    id: 'promotores',
    nome: 'Trade Marketing & Varejo',
    descricao: 'Ações de degustação e promotores em supermercados e lojas',
    icone: 'ShoppingBag',
    termos: {
      ponto: 'Loja / Supermercado',
      pontos: 'Lojas & Pontos de Venda',
      pessoa: 'Promotor(a)',
      pessoas: 'Promotores',
      tituloEscala: 'Escala de Degustação & Ações',
      subtitulo: 'Escolha suas lojas e confirme suas diárias',
      acaoVaga: 'Garantir Diária',
      acaoCancelar: 'Liberar Diária',
      textoWhatsapp: '📋 ESCALA DE AÇÕES / DEGUSTAÇÃO',
      equipeAutorizada: 'Promotores Autorizados',
      artigoPonto: 'a',
      artigoPessoa: 'o',
    },
  },
  igrejas: {
    id: 'igrejas',
    nome: 'Igrejas & Voluntariado',
    descricao: 'Escala de voluntários para cultos, ministérios e ações sociais',
    icone: 'HeartHandshake',
    termos: {
      ponto: 'Ministério / Setor',
      pontos: 'Ministérios & Áreas',
      pessoa: 'Voluntário(a)',
      pessoas: 'Voluntários',
      tituloEscala: 'Escala de Ministérios & Cultos',
      subtitulo: 'Escolha onde e quando você irá servir nesta semana',
      acaoVaga: 'Servir Neste Horário',
      acaoCancelar: 'Liberar Horário',
      textoWhatsapp: '📋 ESCALA DE VOLUNTÁRIOS',
      equipeAutorizada: 'Voluntários Cadastrados',
      artigoPonto: 'o',
      artigoPessoa: 'o',
    },
  },
  esportes: {
    id: 'esportes',
    nome: 'Arenas, Crossfit & Estúdios',
    descricao: 'Quadras de beach tennis, boxes de crossfit, pilates e lutas',
    icone: 'Dumbbell',
    termos: {
      ponto: 'Quadra / Box / Sala',
      pontos: 'Quadras & Modalidades',
      pessoa: 'Aluno(a) / Atleta',
      pessoas: 'Alunos / Atletas',
      tituloEscala: 'Escala de Aulas & Treinos',
      subtitulo: 'Garanta sua vaga na aula ou no treino',
      acaoVaga: 'Reservar Vaga',
      acaoCancelar: 'Cancelar Reserva',
      textoWhatsapp: '📋 ESCALA DE AULAS',
      equipeAutorizada: 'Alunos Matriculados',
      artigoPonto: 'a',
      artigoPessoa: 'o',
    },
  },
  personalizado: {
    id: 'personalizado',
    nome: 'Personalizado (Outro Segmento)',
    descricao: 'Defina exatamente como seus locais, vagas e equipe devem ser chamados',
    icone: 'SlidersHorizontal',
    termos: {
      ponto: 'Local',
      pontos: 'Locais',
      pessoa: 'Participante',
      pessoas: 'Participantes',
      tituloEscala: 'Escala de Horários',
      subtitulo: 'Selecione seu horário e confirme sua vaga',
      acaoVaga: 'Garantir Vaga',
      acaoCancelar: 'Cancelar Vaga',
      textoWhatsapp: '📋 ESCALA DE HORÁRIOS',
      equipeAutorizada: 'Membros Autorizados',
      artigoPonto: 'o',
      artigoPessoa: 'o',
    },
  },
}

/**
 * Obtém os termos consolidados de uma empresa.
 * Se a empresa tiver termos salvos em JSONB, mescla com o fallback genérico.
 * Se tiver um presetId salvo, herda os termos daquele preset.
 */
export function obterTermos(empresa) {
  const fallback = PRESETS_VOCABULARIO.generico.termos
  if (!empresa) return fallback

  const termosSalvos = empresa.termos || {}

  // Se tiver um preset salvo, usa como base
  const presetBase = termosSalvos.preset && PRESETS_VOCABULARIO[termosSalvos.preset]
    ? PRESETS_VOCABULARIO[termosSalvos.preset].termos
    : fallback

  return {
    ...presetBase,
    ...termosSalvos,
    preset: termosSalvos.preset || 'generico',
  }
}

