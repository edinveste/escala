import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { PRESETS_VOCABULARIO, obterTermos } from '../../lib/vocabularioHelper'

/**
 * Hook com regras de negócio, sincronização e persistência do vocabulário/nicho da empresa.
 */
export function useVocabularioModal({
  isOpen,
  empresa,
  onUpdateEmpresa,
  onClose,
  showToast,
}) {
  const termosAtuais = obterTermos(empresa)

  const [presetSelecionado, setPresetSelecionado] = useState(
    () => empresa?.termos?.preset || 'generico'
  )
  const [modoCustomizado, setModoCustomizado] = useState(
    () => presetSelecionado === 'personalizado' || Boolean(empresa?.termos?.customizado)
  )

  // Campos customizáveis
  const [ponto, setPonto] = useState(() => termosAtuais.ponto)
  const [pontos, setPontos] = useState(() => termosAtuais.pontos)
  const [pessoa, setPessoa] = useState(() => termosAtuais.pessoa)
  const [pessoas, setPessoas] = useState(() => termosAtuais.pessoas)
  const [tituloEscala, setTituloEscala] = useState(() => termosAtuais.tituloEscala)
  const [acaoVaga, setAcaoVaga] = useState(() => termosAtuais.acaoVaga)
  const [acaoCancelar, setAcaoCancelar] = useState(() => termosAtuais.acaoCancelar)

  const [saving, setSaving] = useState(false)

  // Sincroniza o estado interno sempre que o modal for aberto ou a empresa mudar
  useEffect(() => {
    if (!isOpen) return
    const termos = obterTermos(empresa)
    const preset = empresa?.termos?.preset || 'generico'
    setPresetSelecionado(preset)
    setModoCustomizado(preset === 'personalizado' || Boolean(empresa?.termos?.customizado))
    setPonto(termos.ponto)
    setPontos(termos.pontos)
    setPessoa(termos.pessoa)
    setPessoas(termos.pessoas)
    setTituloEscala(termos.tituloEscala)
    setAcaoVaga(termos.acaoVaga)
    setAcaoCancelar(termos.acaoCancelar)
  }, [isOpen, empresa])

  // Ao trocar de preset no dropdown
  const handleTrocaPreset = useCallback((presetKey) => {
    setPresetSelecionado(presetKey)
    const preset = PRESETS_VOCABULARIO[presetKey]
    if (preset) {
      setPonto(preset.termos.ponto)
      setPontos(preset.termos.pontos)
      setPessoa(preset.termos.pessoa)
      setPessoas(preset.termos.pessoas)
      setTituloEscala(preset.termos.tituloEscala)
      setAcaoVaga(preset.termos.acaoVaga)
      setAcaoCancelar(preset.termos.acaoCancelar)
      if (presetKey === 'personalizado') {
        setModoCustomizado(true)
      }
    }
  }, [])

  // Salvar vocabulário no Supabase (com fallback seguro por RPC)
  const handleSalvar = useCallback(async () => {
    if (!empresa?.id) return

    setSaving(true)
    try {
      const payloadTermos = {
        preset: presetSelecionado,
        customizado: modoCustomizado,
        ponto: ponto.trim() || 'Ponto de Escala',
        pontos: pontos.trim() || 'Pontos de Escala',
        pessoa: pessoa.trim() || 'Colaborador(a)',
        pessoas: pessoas.trim() || 'Equipe',
        tituloEscala: tituloEscala.trim() || 'Gestão de Escalas',
        subtitulo: 'Selecione seu horário e garanta sua vaga',
        acaoVaga: acaoVaga.trim() || 'Garantir Vaga',
        acaoCancelar: acaoCancelar.trim() || 'Cancelar Minha Vaga',
        textoWhatsapp: `📋 ${tituloEscala.toUpperCase()}`,
        equipeAutorizada: `Equipe de ${pessoas.trim() || 'Membros'}`,
        artigoPonto: 'o',
        artigoPessoa: 'o',
      }

      // 1. Tenta atualizar direto na tabela empresas
      const { error: updateErr } = await supabase
        .from('empresas')
        .update({ termos: payloadTermos })
        .eq('id', empresa.id)

      if (updateErr) {
        // Fallback: RPC atualizar_termos_empresa
        const { error: rpcErr } = await supabase.rpc('atualizar_termos_empresa', {
          p_empresa_id: empresa.id,
          p_termos: payloadTermos,
        })
        if (rpcErr) throw rpcErr
      }

      // Atualiza estado local imediatamente
      if (onUpdateEmpresa) {
        onUpdateEmpresa({ ...empresa, termos: payloadTermos })
      }

      showToast?.('Vocabulário do nicho atualizado com sucesso!', 'success')
      onClose()
    } catch (err) {
      console.error('Erro ao salvar termos:', err)
      showToast?.('Erro ao salvar termos: ' + (err.message || err), 'error')
    } finally {
      setSaving(false)
    }
  }, [
    empresa,
    presetSelecionado,
    modoCustomizado,
    ponto,
    pontos,
    pessoa,
    pessoas,
    tituloEscala,
    acaoVaga,
    acaoCancelar,
    onUpdateEmpresa,
    onClose,
    showToast,
  ])

  return {
    presetSelecionado,
    modoCustomizado,
    setModoCustomizado,
    ponto,
    setPonto,
    pontos,
    setPontos,
    pessoa,
    setPessoa,
    pessoas,
    setPessoas,
    tituloEscala,
    setTituloEscala,
    acaoVaga,
    setAcaoVaga,
    acaoCancelar,
    setAcaoCancelar,
    saving,
    handleTrocaPreset,
    handleSalvar,
  }
}

