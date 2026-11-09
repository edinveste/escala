import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useConfirm } from './ConfirmModal'
import { getPublicShareUrl } from '../lib/tenantHelper'
import { obterTermos } from '../lib/vocabularioHelper'
import {
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Lock,
  Share2,
  Sparkles,
  AlertTriangle,
} from 'lucide-react'

export default function LinkSeguroManager({
  empresa,
  onEmpresaUpdated,
  showToast,
  isFullAdmin,
}) {
  const confirm = useConfirm()
  const [copiado, setCopiado] = useState(false)
  const [redefinindo, setRedefinindo] = useState(false)

  const termos = useMemo(() => obterTermos(empresa), [empresa])

  if (!empresa?.id) return null

  const shareUrl = getPublicShareUrl(empresa)
  const codigoAtual = empresa.codigo_escala || empresa.slug

  // Copia o link direto para a área de transferência
  const handleCopiarLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopiado(true)
      showToast('Link seguro copiado! Envie no WhatsApp da sua equipe 📋', 'success')
      setTimeout(() => setCopiado(false), 2500)
    } catch (err) {
      // Fallback para textarea invisível
      const ta = document.createElement('textarea')
      ta.value = shareUrl
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopiado(true)
      showToast('Link seguro copiado com sucesso! 📋', 'success')
      setTimeout(() => setCopiado(false), 2500)
    }
  }

  // Compartilha mensagem pronta formatada com emoji no WhatsApp
  const handleCompartilharWhatsApp = () => {
    const titulo = (termos.textoWhatsapp || 'ESCALA').replace('📋', '').trim()
    const texto = encodeURIComponent(
      `📋 *${titulo} — ${empresa.nome}*\n\n` +
      `Garanta ou consulte sua vaga em tempo real no nosso link oficial:\n` +
      `👉 ${shareUrl}\n\n` +
      `_Acesso exclusivo para os membros autorizados da equipe._`
    )
    window.open(`https://api.whatsapp.com/send?text=${texto}`, '_blank')
  }

  // Redefine o código aleatório de 12 caracteres via RPC segura
  const handleRedefinirCodigo = async () => {
    if (!isFullAdmin) {
      showToast('Apenas administradores podem redefinir o link seguro da escala.', 'error')
      return
    }

    const aprovado = await confirm({
      title: 'Redefinir Link Seguro da Escala?',
      message:
        'Ao gerar um novo link de 12 caracteres, o link anterior deixará de funcionar imediatamente.\n\n' +
        '⚠️ Membros da equipe que utilizam o link antigo não conseguirão mais acessar a escala até receberem o novo endereço no grupo do WhatsApp.\n\n' +
        'Utilize esta opção caso o link tenha vazado para concorrentes ou colaboradores tenham sido desligados da equipe.',
      confirmText: 'Sim, Gerar Novo Link',
      cancelText: 'Cancelar',
      variant: 'warning',
    })

    if (!aprovado) return

    setRedefinindo(true)
    try {
      const { data: novoCodigo, error } = await supabase.rpc('redefinir_codigo_escala', {
        p_empresa_id: empresa.id,
      })

      if (error) throw error

      if (novoCodigo) {
        if (typeof onEmpresaUpdated === 'function') {
          onEmpresaUpdated({
            ...empresa,
            codigo_escala: novoCodigo,
          })
        }
        showToast(
          'Novo link seguro de 12 caracteres gerado! O link antigo foi revogado com sucesso 🛡️',
          'success'
        )
      }
    } catch (err) {
      console.error('Erro ao redefinir link da escala:', err)
      showToast(err.message || 'Erro ao redefinir link seguro.', 'error')
    } finally {
      setRedefinindo(false)
    }
  }

  return (
    <div className="card p-4 sm:p-5 border-brand-500/25 bg-surface-800/90 shadow-lg relative overflow-hidden transition-all">
      {/* Detalhe de fundo decorativo */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-brand-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Cabeçalho do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 sm:p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-brand-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-gray-100 flex items-center gap-1.5 truncate">
                Link Seguro da Escala
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Anti-Espionagem Ativo
              </span>
            </div>
          </div>
        </div>

        {/* Botão de Redefinir Link */}
        {isFullAdmin && (
          <button
            type="button"
            onClick={handleRedefinirCodigo}
            disabled={redefinindo}
            className="self-start sm:self-auto text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex-shrink-0"
            title="Gera um novo código aleatório de 12 caracteres e invalida o anterior imediatamente"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${redefinindo ? 'animate-spin' : ''}`} />
            <span>{redefinindo ? 'Gerando...' : 'Redefinir Link Seguro'}</span>
          </button>
        )}
      </div>

      {/* Barra de exibição do link e botões de ação */}
      <div className="flex items-center gap-2 pt-1">
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            readOnly
            value={shareUrl}
            onClick={(e) => e.target.select()}
            className="input-field text-xs sm:text-sm font-mono py-2 sm:py-2.5 px-3 text-gray-200 bg-surface-900 border-surface-600 select-all cursor-text"
            aria-label="URL segura da escala"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Botão Copiar (Apenas ícone) */}
          <button
            type="button"
            onClick={handleCopiarLink}
            className={`p-2 sm:p-2.5 rounded-xl border active:scale-95 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center flex-shrink-0 shadow-sm ${
              copiado
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-surface-700/60 hover:bg-surface-700 text-gray-200 border-surface-600 hover:border-brand-500/50 hover:text-brand-300'
            }`}
            title={copiado ? 'Link copiado!' : 'Copiar link'}
            aria-label={copiado ? 'Link copiado!' : 'Copiar link'}
          >
            {copiado ? (
              <Check className="w-4 h-4 text-white" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {/* Botão Enviar no WhatsApp */}
          <button
            type="button"
            onClick={handleCompartilharWhatsApp}
            className="p-2 sm:p-2.5 rounded-xl bg-surface-700/60 hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-400 border border-surface-600 hover:border-emerald-500/40 active:scale-95 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center flex-shrink-0"
            title="Compartilhar convite diretamente no WhatsApp"
            aria-label="Compartilhar convite diretamente no WhatsApp"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Botão Abrir Visualização Pública */}
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 sm:p-2.5 rounded-xl text-gray-400 hover:text-gray-200 bg-surface-700/60 hover:bg-surface-700 border border-surface-600 active:scale-95 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center flex-shrink-0"
            title="Visualizar a escala exatamente como sua equipe a vê"
            aria-label="Visualizar a escala em nova aba"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  )
}

