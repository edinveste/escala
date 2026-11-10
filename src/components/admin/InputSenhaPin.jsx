import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Campo reutilizável para entrada de senha/PIN com botão integrado de
 * alternância de visibilidade (Eye/EyeOff) e slot opcional para validações/feedback.
 */
export default function InputSenhaPin({
  label,
  value,
  onChange,
  placeholder = 'Digite a senha',
  required = true,
  disabled = false,
  autoFocus = false,
  children,
}) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div>
      {label && (
        <label className="text-xs font-semibold text-gray-300 mb-1.5 block">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          className="input-field pr-12 font-mono placeholder:font-sans placeholder:text-sm placeholder:text-gray-500"
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          disabled={disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 p-1 disabled:opacity-50"
          tabIndex={-1}
          title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {children}
    </div>
  )
}

