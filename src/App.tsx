import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ShieldCheck,
  User,
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff
} from 'lucide-react';

// =============================================================================
// CONFIGURATION & UTILS
// =============================================================================

const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.chefgroep.nl';
const AUTH_HOST_SUFFIX = '.chefgroep.nl';
const DEFAULT_RETURN_TO = 'https://mc.chefgroep.nl/mission-control';

// Regex for username validation (alphanumeric, underscores, hyphens, 3-20 chars)
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

// =============================================================================
// ASSETS
// =============================================================================

function WhaleLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8 36C8 36 12 24 32 24C52 24 56 32 56 32C56 32 58 34 56 38C54 42 48 44 48 44L44 46C44 46 38 50 28 50C18 50 12 42 8 36Z"
        fill="currentColor"
      />
      <circle cx="46" cy="30" r="2" fill="#0f172a" />
      <path
        d="M36 44C36 44 40 46 44 46"
        stroke="#0f172a"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.2"
      />
    </svg>
  );
}

// =============================================================================
// COMPONENTS
// =============================================================================

function InputField({
  id,
  type = 'text',
  label,
  value,
  onChange,
  placeholder,
  icon: Icon,
  error,
  required = false,
  autoComplete,
  disabled = false
}: {
  id: string;
  type?: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  icon: React.ElementType;
  error?: string;
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-300">
        {label}
      </label>
      <div className="relative group">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-sky-400 transition-colors duration-200">
          <Icon className="w-5 h-5" />
        </div>
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          className={`
            w-full bg-slate-900/50 border rounded-lg pl-10 pr-4 py-2.5
            text-slate-100 placeholder:text-slate-600
            focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
            ${error ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700'}
            ${isPassword ? 'pr-10' : ''}
          `}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1 mt-1" role="alert">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}

function StatusAlert({ type, message }: { type: 'error' | 'success' | null; message: string }) {
  if (!type || !message) return null;

  const isError = type === 'error';
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`
        p-4 rounded-lg flex items-start gap-3 text-sm border
        ${isError 
          ? 'bg-red-950/30 border-red-900/50 text-red-200' 
          : 'bg-emerald-950/30 border-emerald-900/50 text-emerald-200'}
      `}
      role="alert"
    >
      <Icon className={`w-5 h-5 shrink-0 ${isError ? 'text-red-400' : 'text-emerald-400'}`} />
      <span className="leading-relaxed">{message}</span>
    </motion.div>
  );
}

// =============================================================================
// MAIN APP
// =============================================================================

export default function App() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'error' | 'success' | null; message: string }>({ type: null, message: '' });
  
  // Form State
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    email: ''
  });

  // Return URL State
  const [returnTo, setReturnTo] = useState(DEFAULT_RETURN_TO);
  const [returnHost, setReturnHost] = useState('mc.chefgroep.nl');

  // Initialize Return URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('return_to') || '';
    
    if (raw) {
      try {
        const url = new URL(raw, window.location.origin);
        // Strict validation: must be https and end with .chefgroep.nl or be exactly chefgroep.nl
        if (
          url.protocol === 'https:' && 
          (url.hostname === 'chefgroep.nl' || url.hostname.endsWith(AUTH_HOST_SUFFIX))
        ) {
          setReturnTo(url.toString());
          setReturnHost(url.hostname);
        }
      } catch {
        // Invalid URL, ignore and keep default
      }
    }
  }, []);

  const handleFieldChange = (field: keyof typeof form) => (value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (status.type === 'error') setStatus({ type: null, message: '' });
  };

  const validateForm = () => {
    if (!form.username || !form.password) {
      setStatus({ type: 'error', message: 'Vul alle verplichte velden in.' });
      return false;
    }

    if (mode === 'register') {
      if (!form.name || !form.email) {
        setStatus({ type: 'error', message: 'Vul alle verplichte velden in.' });
        return false;
      }
      if (!USERNAME_REGEX.test(form.username)) {
        setStatus({ type: 'error', message: 'Gebruikersnaam mag alleen letters, cijfers, - en _ bevatten (3-20 tekens).' });
        return false;
      }
      if (form.password.length < 8) {
        setStatus({ type: 'error', message: 'Wachtwoord moet minimaal 8 tekens bevatten.' });
        return false;
      }
      if (form.password !== form.confirmPassword) {
        setStatus({ type: 'error', message: 'Wachtwoorden komen niet overeen.' });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setStatus({ type: null, message: '' });

    try {
      const endpoint = mode === 'login' ? '/api/v1/auth' : '/api/v1/register';
      const payload = mode === 'login' 
        ? { username: form.username, password: form.password }
        : { 
            username: form.username, 
            password: form.password, 
            name: form.name, 
            email: form.email 
          };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important for cookies
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || (mode === 'login' ? 'Inloggen mislukt.' : 'Registratie mislukt.'));
      }

      if (mode === 'login') {
        if (data.authenticated) {
          setStatus({ type: 'success', message: 'Succesvol ingelogd. Je wordt doorgestuurd...' });
          setTimeout(() => {
            window.location.href = returnTo;
          }, 800);
        } else {
          throw new Error('Authenticatie mislukt.');
        }
      } else {
        setStatus({ type: 'success', message: 'Account aangemaakt! Je kunt nu inloggen.' });
        setTimeout(() => {
          setMode('login');
          setForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
          setStatus({ type: null, message: '' });
        }, 2000);
      }
    } catch (err) {
      setStatus({ 
        type: 'error', 
        message: err instanceof Error ? err.message : 'Er is een onverwachte fout opgetreden.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-4 selection:bg-sky-500/30">
      {/* Background Gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[400px] relative z-10"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl mb-6 text-sky-500">
            <WhaleLogo className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight mb-2">
            {mode === 'login' ? 'Welkom terug' : 'Account aanmaken'}
          </h1>
          <p className="text-slate-400 text-sm">
            {mode === 'login' 
              ? 'Log in om toegang te krijgen tot ChefGroep.' 
              : 'Vraag toegang aan tot het ChefGroep platform.'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="grid grid-cols-2 border-b border-white/5 p-1 gap-1 bg-slate-900/50">
            <button
              onClick={() => { setMode('login'); setStatus({ type: null, message: '' }); }}
              className={`
                text-sm font-medium py-2.5 rounded-lg transition-all duration-200
                ${mode === 'login' 
                  ? 'bg-slate-800 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}
              `}
            >
              Inloggen
            </button>
            <button
              onClick={() => { setMode('register'); setStatus({ type: null, message: '' }); }}
              className={`
                text-sm font-medium py-2.5 rounded-lg transition-all duration-200
                ${mode === 'register' 
                  ? 'bg-slate-800 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}
              `}
            >
              Registreren
            </button>
          </div>

          {/* Form */}
          <div className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <AnimatePresence mode="wait">
                {status.message && (
                  <div className="mb-6">
                    <StatusAlert type={status.type} message={status.message} />
                  </div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: mode === 'login' ? 20 : -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {mode === 'register' && (
                    <>
                      <InputField
                        id="name"
                        label="Volledige naam"
                        placeholder="Jan de Vries"
                        value={form.name}
                        onChange={handleFieldChange('name')}
                        icon={User}
                        required
                        autoComplete="name"
                        disabled={isLoading}
                      />
                      <InputField
                        id="email"
                        type="email"
                        label="E-mailadres"
                        placeholder="jan@voorbeeld.nl"
                        value={form.email}
                        onChange={handleFieldChange('email')}
                        icon={Mail}
                        required
                        autoComplete="email"
                        disabled={isLoading}
                      />
                    </>
                  )}

                  <InputField
                    id="username"
                    label="Gebruikersnaam"
                    placeholder="gebruikersnaam"
                    value={form.username}
                    onChange={handleFieldChange('username')}
                    icon={User}
                    required
                    autoComplete="username"
                    disabled={isLoading}
                  />

                  <InputField
                    id="password"
                    type="password"
                    label="Wachtwoord"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleFieldChange('password')}
                    icon={Lock}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    disabled={isLoading}
                  />

                  {mode === 'register' && (
                    <InputField
                      id="confirmPassword"
                      type="password"
                      label="Bevestig wachtwoord"
                      placeholder="••••••••"
                      value={form.confirmPassword}
                      onChange={handleFieldChange('confirmPassword')}
                      icon={Lock}
                      required
                      autoComplete="new-password"
                      disabled={isLoading}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              <button
                type="submit"
                disabled={isLoading}
                className={`
                  w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg
                  bg-sky-600 hover:bg-sky-500 text-white font-medium
                  focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:ring-offset-2 focus:ring-offset-slate-900
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200 shadow-lg shadow-sky-900/20
                  mt-6
                `}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Inloggen' : 'Account aanmaken'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/50 border border-slate-800 text-xs text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Beveiligd voor <span className="text-slate-300 font-medium">{returnHost}</span></span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
