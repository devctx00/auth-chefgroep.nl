import { useState, type ElementType } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type InputFieldProps = {
  id: string;
  type: 'text' | 'email' | 'password';
  label: string;
  placeholder: string;
  value: string;
  onChange: (nextValue: string) => void;
  icon: ElementType;
  disabled: boolean;
  autoComplete: string;
};

export default function InputField({
  id,
  type,
  label,
  placeholder,
  value,
  onChange,
  icon,
  disabled,
  autoComplete,
}: InputFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const Icon = icon;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field-input-wrap">
        <Icon className="field-icon" aria-hidden="true" />
        <input
          id={id}
          type={type === 'password' && showPassword ? 'text' : type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          required
        />
        {type === 'password' && (
          <button
            type="button"
            className="field-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Verberg invoer' : 'Toon invoer'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}
