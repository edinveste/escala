import PontoSelectorClassico from './PontoSelectorClassico'
import PontoSelectorModerno from './PontoSelectorModerno'

/**
 * PontoSelectorView — Ponto de entrada dinâmico da seleção de pontos.
 * Suporta alternância de layout configurável pelo gestor:
 * - 'moderno': Layout rico com branding, busca, barra de métricas, progresso e agenda destacada.
 * - 'classico': Layout original enxuto e minimalista preservado integralmente.
 */
export default function PontoSelectorView(props) {
  const layout =
    props.empresa?.termos?.layout_pontos ||
    props.termos?.layout_pontos ||
    props.empresa?.layout_pontos ||
    (typeof window !== 'undefined' && props.empresa?.id
      ? localStorage.getItem('escala_layout_' + props.empresa.id)
      : null) ||
    'moderno'

  if (layout === 'classico') {
    return <PontoSelectorClassico {...props} />
  }

  return <PontoSelectorModerno {...props} />
}

export { PontoSelectorClassico, PontoSelectorModerno }
