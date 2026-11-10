import { useState, useEffect } from 'react'
import {
  GestoresHeader,
  GestoresInfoCard,
  FormAddGestor,
  GestoresList,
  useGestores,
} from './gestores'

/**
 * GestoresManager — Orquestrador do gerenciamento de Coordenadores e Administradores da Imobiliária.
 * Componente modularizado de alta manutenibilidade com separação de regras de negócio e apresentação.
 */
export default function GestoresManager({
  empresaId,
  empresaNome,
  isFullAdmin = true,
  currentUserId,
  showToast,
  termos,
}) {
  // Chave de persistência de preferência de expansão da sanfona (por empresa)
  const STORAGE_KEY_GESTORES_EXPANDED = empresaId
    ? `escala_gestores_expanded_${empresaId}`
    : 'escala_gestores_expanded'

  // Por padrão recolhido (fechado), restaurando a preferência do usuário se houver
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_GESTORES_EXPANDED)
      if (salvo !== null) {
        return JSON.parse(salvo)
      }
    } catch (err) {
      console.error('Erro ao ler preferência de gestores expandidos:', err)
    }
    return false
  })

  // Salva no localStorage sempre que o usuário alternar o estado de expansão
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_GESTORES_EXPANDED, JSON.stringify(isExpanded))
    } catch (err) {
      console.error('Erro ao salvar preferência de gestores expandidos:', err)
    }
  }, [isExpanded, STORAGE_KEY_GESTORES_EXPANDED])

  // Hook isolado com dados, Realtime e mutações via RPCs do Supabase
  const {
    gestores,
    loading,
    adicionando,
    vincularGestor,
    removerGestor,
  } = useGestores({
    empresaId,
    currentUserId,
    showToast,
  })

  // Apenas administradores com permissão total podem visualizar e gerenciar gestores
  if (!isFullAdmin) return null

  return (
    <div className="card space-y-4">
      {/* ═══ CABEÇALHO DO MÓDULO (COM CONTADOR E SANFONA) ═══ */}
      <GestoresHeader
        totalMembros={gestores.length}
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded((prev) => !prev)}
      />

      {/* ═══ CONTEÚDO EXPANSÍVEL ═══ */}
      {isExpanded && (
        <div className="space-y-4 pt-2 border-t border-surface-700/60 animate-fade-in">
          {/* Card explicativo das permissões e papéis do sistema (RBAC) */}
          <GestoresInfoCard termos={termos} />

          {/* Formulário para vincular ou convidar novo gestor/coordenador */}
          <FormAddGestor
            onVincular={vincularGestor}
            loading={adicionando}
          />

          {/* Listagem com avatares, status de convites e ações */}
          <GestoresList
            gestores={gestores}
            loading={loading}
            currentUserId={currentUserId}
            onRemoveGestor={removerGestor}
          />
        </div>
      )}
    </div>
  )
}
