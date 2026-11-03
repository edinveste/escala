import { useState, useEffect, useCallback } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('escala_theme')
      if (stored === 'light' || stored === 'dark') {
        return stored
      }
      // Padrão do sistema é dark
      return document.documentElement.classList.contains('dark') ? 'dark' : 'dark'
    } catch {
      return 'dark'
    }
  })

  // Sincroniza a classe 'dark' e a meta theme-color no HTML
  const applyTheme = useCallback((newTheme) => {
    const isDark = newTheme === 'dark'
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    try {
      localStorage.setItem('escala_theme', newTheme)
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) {
        meta.setAttribute('content', isDark ? '#0f1117' : '#f8fafc')
      }
    } catch (err) {
      console.error('Erro ao salvar tema:', err)
    }
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme, applyTheme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2.5 rounded-xl hover:bg-surface-700 active:scale-95 transition-all duration-200 text-gray-400 hover:text-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center select-none ${className}`}
      title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      aria-label={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-amber-400 hover:rotate-45 transition-transform duration-300" />
      ) : (
        <Moon className="w-5 h-5 text-brand-600 hover:-rotate-12 transition-transform duration-300" />
      )}
    </button>
  )
}

