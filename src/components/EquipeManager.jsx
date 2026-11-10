import { useState, useEffect, useMemo } from 'react'
import {
  EquipeHeader,
  EquipeStatusBanner,
  EquipeList,
  TipoValidacaoSelector,
  AdicionarMembroForm,
  EditarMembroModal,
  useEquipe,
} from './equipe'
import { TIPOS_VALIDACAO } from '../lib/validacaoHelper'

export default function EquipeManager({
  empresaId,
  empresaNome,
  exigirCadastro = false,
  onExigirCadastroChange,
  tipoValidacao: propTipoValidacao = TIPOS_VALIDACAO.WHATSAPP,
  onTipoValidacaoChange,
  isFullAdmin = true,
  showToast,
  termos = {},
}) {
  const [busca, setBusca] = useState('')
  const [tipoValidacao, setTipoValidacao] = useState(propTipoValidacao)
  const [colaboradorParaEditar, setColaboradorParaEditar] = useState(null)

  useEffect(() => {
    if (propTipoValidacao) {
      setTipoValidacao(propTipoValidacao)
    }
  }, [propTipoValidacao])

  // Chave de persistência de preferência da sanfona (por empresa)
  const STORAGE_KEY_EQUIPE_EXPANDED = empresaId
    ? `escala_equipe_expanded_${empresaId}`
    : 'escala_equipe_expanded'

  // Por padrão recolhido (fechado), restaurando a preferência do usuário se houver
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_EQUIPE_EXPANDED)
      if (salvo !== null) {
        return JSON.parse(salvo)
      }
    } catch (err) {
      console.error('Erro ao ler preferência de equipe expandida:', err)
    }
    return false
  })

  // Salva no localStorage sempre que o usuário alternar
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EQUIPE_EXPANDED, JSON.stringify(isExpanded))
    } catch (err) {
      console.error('Erro ao salvar preferência de equipe expandida:', err)
    }
  }, [isExpanded, STORAGE_KEY_EQUIPE_EXPANDED])

  // Hook isolado de regras de negócio, dados e realtime da equipe
  const {
    equipe,
    loading,
    alterandoExigir,
    toggleExigirCadastro,
    adicionarMembro,
    editarMembro,
    toggleAtivo,
    deleteColaborador,
    desvincularAparelho,
  } = useEquipe({
    empresaId,
    exigirCadastro,
    onExigirCadastroChange,
    isFullAdmin,
    showToast,
  })

  // Alternar tipo de validação de equipe
  const handleTipoValidacaoChange = (novoTipo) => {
    setTipoValidacao(novoTipo)
    onTipoValidacaoChange?.()
  }

  // Filtro de busca (Nome, WhatsApp ou E-mail)
  const equipeFiltrada = useMemo(() => {
    if (!busca.trim()) return equipe
    const b = busca.toLowerCase().trim()
    const bDigits = busca.replace(/\D/g, '')
    return equipe.filter((c) => {
      const matchNome = c.nome.toLowerCase().includes(b)
      const matchZap = bDigits && (c.whatsapp || '').replace(/\D/g, '').includes(bDigits)
      const matchEmail = (c.email || '').toLowerCase().includes(b)
      return matchNome || matchZap || matchEmail
    })
  }, [equipe, busca])

  const totalAtivos = useMemo(
    () => equipe.filter((c) => c.ativo !== false).length,
    [equipe]
  )

  return (
    <div className="card space-y-4">
      {/* ═══ CABEÇALHO UNIFICADO: PROTEÇÃO CONTRA INVASORES ═══ */}
      <EquipeHeader
        exigirCadastro={exigirCadastro}
        totalAtivos={totalAtivos}
        alterandoExigir={alterandoExigir}
        isFullAdmin={isFullAdmin}
        onToggleExigir={toggleExigirCadastro}
        isExpanded={isExpanded}
        onToggleExpand={() => setIsExpanded((prev) => !prev)}
      />

      {/* ═══ CONTEÚDO EXPANSÍVEL (SANFONA) ═══ */}
      {isExpanded && (
        <div className="space-y-4 pt-2 border-t border-surface-700/60 animate-fade-in">
          {/* Card Contextual de Status da Proteção */}
          <EquipeStatusBanner
            exigirCadastro={exigirCadastro}
            termos={termos}
          />

          {/* ═══ SELETOR MODULAR DE IDENTIFICAÇÃO (WHATSAPP, E-MAIL, AMBOS) ═══ */}
          <TipoValidacaoSelector
            empresaId={empresaId}
            tipoAtual={tipoValidacao}
            onTipoChange={handleTipoValidacaoChange}
            isFullAdmin={isFullAdmin}
            showToast={showToast}
          />

          {/* ═══ FORMULÁRIO MODULAR DE CADASTRO DE COLABORADOR ═══ */}
          <AdicionarMembroForm
            tipoValidacao={tipoValidacao}
            termos={termos}
            equipe={equipe}
            onAdicionar={adicionarMembro}
            showToast={showToast}
          />

          {/* ═══ LISTAGEM DA EQUIPE ═══ */}
          <EquipeList
            equipeFiltrada={equipeFiltrada}
            totalMembros={equipe.length}
            loading={loading}
            busca={busca}
            onBuscaChange={setBusca}
            termos={termos}
            tipoValidacao={tipoValidacao}
            onEditar={setColaboradorParaEditar}
            onDesvincularAparelho={desvincularAparelho}
            onToggleAtivo={toggleAtivo}
            onDelete={deleteColaborador}
          />
        </div>
      )}

      {/* ═══ MODAL DE EDIÇÃO DE COLABORADOR ═══ */}
      <EditarMembroModal
        isOpen={Boolean(colaboradorParaEditar)}
        colaborador={colaboradorParaEditar}
        onClose={() => setColaboradorParaEditar(null)}
        onSalvar={editarMembro}
        onDesvincularAparelho={desvincularAparelho}
        tipoValidacao={tipoValidacao}
        termos={termos}
        equipe={equipe}
        showToast={showToast}
      />
    </div>
  )
}
