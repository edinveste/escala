import { Shield } from 'lucide-react'

const TITULOS = {
  login: 'Painel de Gestão',
  cadastro: 'Criar Acesso de Gestor',
  recuperar: 'Recuperar Senha',
}

const SUBTITULOS = {
  login: 'Área restrita para administradores e gestores de plantão.',
  cadastro: 'Cadastre-se para gerenciar as escalas da sua empresa.',
  recuperar: 'Informe seu e-mail para receber as instruções de redefinição.',
}

/**
 * Cabeçalho interno do Card de Autenticação (Ícone de Escudo, Título e Subtítulo dinâmicos).
 */
export default function PortalCardHeader({ modo }) {
  return (
    <div className="text-center space-y-2">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center shadow-inner">
        <Shield className="w-7 h-7" />
      </div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-100">
        {TITULOS[modo] || TITULOS.login}
      </h2>
      <p className="text-xs sm:text-sm text-gray-400 max-w-xs mx-auto">
        {SUBTITULOS[modo] || SUBTITULOS.login}
      </p>
    </div>
  )
}

