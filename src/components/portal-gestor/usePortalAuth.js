import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { validarSenhaForte } from '../../lib/validacaoHelper'

/**
 * Hook customizado de autenticação e estado do Portal do Gestor.
 * Isola toda a lógica de submissão, validação, tratamento de erros e gerenciamento de foco.
 */
export function usePortalAuth({ onSuccess, showToast, empresaId }) {
  const { signIn, signUp, resetPassword, refreshAuth } = useAuth()

  // Modos de autenticação: 'login' | 'cadastro' | 'recuperar' | 'pin_legado'
  const [modo, setModo] = useState('login')

  // Campos do formulário
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [empresaNome, setEmpresaNome] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [pinLegado, setPinLegado] = useState('')
  const [showPinLegado, setShowPinLegado] = useState(false)

  // Estados de controle e feedback
  const [enviando, setEnviando] = useState(false)
  const [erroMsg, setErroMsg] = useState('')
  const [sucessoMsg, setSucessoMsg] = useState('')

  // Referências para foco automático
  const emailInputRef = useRef(null)
  const pinInputRef = useRef(null)

  // Alterna o modo limpando mensagens anteriores
  const switchModo = useCallback((novoModo) => {
    setModo(novoModo)
    setErroMsg('')
    setSucessoMsg('')
  }, [])

  // Gerencia o foco do input ao alternar os modos
  useEffect(() => {
    setErroMsg('')
    setSucessoMsg('')
    const timer = setTimeout(() => {
      if (modo === 'pin_legado') {
        pinInputRef.current?.focus()
      } else {
        emailInputRef.current?.focus()
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [modo])

  // Submissão: Login via Supabase Auth
  const handleLogin = async (e) => {
    if (e) e.preventDefault()
    setErroMsg('')
    setSucessoMsg('')

    if (!email.trim() || !senha) {
      setErroMsg('Preencha seu e-mail e senha para continuar.')
      return
    }

    setEnviando(true)
    try {
      const res = await signIn(email, senha)
      if (showToast) showToast('Login realizado com sucesso! 🛡️', 'success')
      if (onSuccess) onSuccess('auth', res?.empresas?.[0])
    } catch (err) {
      console.error('Erro no login do portal:', err)
      const msg = err.message || ''
      if (msg.includes('Invalid login credentials')) {
        setErroMsg('E-mail ou senha incorretos. Verifique suas credenciais.')
      } else if (msg.includes('Email not confirmed')) {
        setErroMsg('E-mail ainda não confirmado. Verifique sua caixa de entrada.')
      } else {
        setErroMsg('Falha ao autenticar. Verifique sua conexão e tente novamente.')
      }
    } finally {
      setEnviando(false)
    }
  }

  // Submissão: Cadastro de novo Gestor
  const handleCadastro = async (e) => {
    if (e) e.preventDefault()
    setErroMsg('')
    setSucessoMsg('')

    if (!nome.trim() || !empresaNome.trim() || !email.trim() || !senha) {
      setErroMsg('Preencha todos os campos obrigatórios.')
      return
    }

    if (empresaNome.trim().length < 2) {
      setErroMsg('O nome da empresa deve ter pelo menos 2 caracteres.')
      return
    }

    const erroSenha = validarSenhaForte(senha)
    if (erroSenha) {
      setErroMsg(erroSenha)
      return
    }

    setEnviando(true)
    try {
      const { user: newUser, session } = await signUp(email, senha, nome, empresaNome)

      if (session) {
        let novaEmpresa = null
        try {
          const { data: empData, error: empErr } = await supabase.rpc('criar_nova_empresa', {
            p_nome: empresaNome.trim(),
          })
          if (!empErr && empData) {
            novaEmpresa = empData
          }
        } catch (errEmp) {
          console.warn('Empresa já provisionada ou erro no RPC:', errEmp)
        }

        if (refreshAuth) {
          await refreshAuth()
        }

        if (showToast) showToast(`Conta criada com sucesso! Bem-vindo(a), ${nome}! 🎉`, 'success')
        if (onSuccess) onSuccess('auth', novaEmpresa)
      } else if (newUser) {
        setSucessoMsg(
          'Conta cadastrada com sucesso! Um e-mail de confirmação foi enviado para você ativar seu acesso.'
        )
        setModo('login')
      }
    } catch (err) {
      console.error('Erro no cadastro do portal:', err)
      const msg = err.message || ''
      if (msg.includes('already registered')) {
        setErroMsg('Este e-mail já está cadastrado. Tente fazer login ou redefinir sua senha.')
      } else {
        setErroMsg('Erro ao criar conta: ' + (err.message || 'Tente novamente.'))
      }
    } finally {
      setEnviando(false)
    }
  }

  // Submissão: Recuperação de Senha
  const handleRecuperarSenha = async (e) => {
    if (e) e.preventDefault()
    setErroMsg('')
    setSucessoMsg('')

    if (!email.trim()) {
      setErroMsg('Digite seu e-mail cadastrado.')
      return
    }

    setEnviando(true)
    try {
      await resetPassword(email)
      setSucessoMsg('Enviamos um link de recuperação para seu e-mail! Verifique sua caixa de entrada.')
      setModo('login')
    } catch (err) {
      console.error('Erro ao recuperar senha:', err)
      setErroMsg('Não foi possível enviar o e-mail de recuperação. Verifique o endereço digitado.')
    } finally {
      setEnviando(false)
    }
  }

  // Submissão: Validação de PIN de contingência legado
  const handlePinLegado = async (e) => {
    if (e) e.preventDefault()
    setErroMsg('')
    setSucessoMsg('')

    if (!pinLegado.trim()) {
      setErroMsg('Digite o PIN de acesso da empresa.')
      return
    }

    setEnviando(true)
    try {
      // 1. Tenta RPC segura verificar_admin_pin se houver empresaId
      if (empresaId) {
        const { data: pinValido, error: errRpc } = await supabase.rpc('verificar_admin_pin', {
          p_empresa_id: empresaId,
          p_pin_informado: pinLegado.trim(),
        })

        if (!errRpc && pinValido) {
          if (showToast) showToast('Acesso de contingência autorizado via PIN! 🛡️', 'success')
          if (onSuccess) onSuccess('pin')
          return
        }
      }

      // 2. Busca direta da empresa pelo PIN (modo genérico para portal)
      const { data: emp, error: errEmp } = await supabase
        .from('empresas')
        .select('id, nome, slug, admin_pin')
        .eq('admin_pin', pinLegado.trim())
        .maybeSingle()

      if (!errEmp && emp) {
        if (showToast) showToast(`Acesso autorizado para "${emp.nome}" via PIN! 🛡️`, 'success')
        if (onSuccess) onSuccess('pin', emp)
        return
      }

      setErroMsg('PIN de administrador incorreto ou não localizado.')
    } catch (err) {
      console.error('Erro ao verificar PIN legado:', err)
      setErroMsg('Erro ao validar PIN. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return {
    modo,
    setModo,
    switchModo,
    email,
    setEmail,
    senha,
    setSenha,
    nome,
    setNome,
    empresaNome,
    setEmpresaNome,
    showSenha,
    setShowSenha,
    pinLegado,
    setPinLegado,
    showPinLegado,
    setShowPinLegado,
    enviando,
    erroMsg,
    setErroMsg,
    sucessoMsg,
    setSucessoMsg,
    emailInputRef,
    pinInputRef,
    handleLogin,
    handleCadastro,
    handleRecuperarSenha,
    handlePinLegado,
  }
}

