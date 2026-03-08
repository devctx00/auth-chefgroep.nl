import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react';
import { login, logout, me, register } from './lib/authApi';
import { getReturnTarget, redirectTo, validateRegistration, type AuthMode } from './lib/authContract';
import { clearAutoRedirectGuard, hasRecentAutoRedirect, markAutoRedirect } from './lib/redirectGuard';
import { useDensity } from './hooks/useDensity';
import UnderwaterScene from './components/UnderwaterScene';
import InputField from './components/InputField';

type StatusType = 'error' | 'success' | 'info' | null;

type FormState = {
  username: string;
  password: string;
  confirmPassword: string;
  name: string;
  email: string;
};

export default function App() {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = Boolean(prefersReducedMotion);
  const density = useDensity();
  const [mode, setMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [status, setStatus] = useState<{ type: StatusType; message: string }>({
    type: null,
    message: '',
  });
  const [existingUser, setExistingUser] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    email: '',
  });

  const allowDevReturnTo = import.meta.env.VITE_ALLOW_DEV_RETURN_TO === 'true';
  const target = useMemo(
    () =>
      getReturnTarget(window.location.search, window.location.origin, {
        allowDevHosts: allowDevReturnTo,
      }),
    [allowDevReturnTo],
  );

  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  useEffect(() => {
    if (target.switchRequested) return;

    let active = true;

    void me()
      .then((result) => {
        if (!active || !result.ok) return;
        setExistingUser(typeof result.data.user === 'string' ? result.data.user : 'Actieve sessie');
      })
      .catch(() => {
        // Ignore session probe failures.
      });

    return () => {
      active = false;
    };
  }, [target.switchRequested]);

  useEffect(() => {
    if (!existingUser || target.switchRequested || isSwitching) return;

    if (hasRecentAutoRedirect(target.returnTo)) {
      setStatus({
        type: 'error',
        message:
          'Doorsturen is gestopt om een login-loop te voorkomen. Kies "Wissel account" en log opnieuw in.',
      });
      return;
    }

    setStatus({ type: 'info', message: 'Sessie actief. Je wordt doorgestuurd...' });
    const redirectTimer = window.setTimeout(() => {
      markAutoRedirect(target.returnTo);
      redirectTo(target.returnTo, 'replace');
    }, 900);

    return () => {
      window.clearTimeout(redirectTimer);
    };
  }, [existingUser, isSwitching, target.returnTo, target.switchRequested]);

  const onFieldChange = useCallback(
    (field: keyof FormState) => (value: string) => {
      setForm((previous) => ({ ...previous, [field]: value }));
      setStatus((previous) => (previous.type === 'error' ? { type: null, message: '' } : previous));
    },
    [],
  );

  const onModeChange = useCallback((nextMode: AuthMode) => {
    setMode(nextMode);
    setStatus({ type: null, message: '' });
  }, []);

  const onSwitchAccount = useCallback(async () => {
    setIsSwitching(true);
    setStatus({ type: 'info', message: 'Sessie wordt afgemeld...' });

    try {
      const result = await logout();

      if (!result.ok) {
        setStatus({ type: 'error', message: result.data.detail || 'Afmelden mislukt.' });
        return;
      }

      setExistingUser(null);
      clearAutoRedirectGuard();
      setStatus({ type: 'success', message: 'Afgemeld. Log nu in met een ander account.' });
      window.history.replaceState({}, '', `${window.location.pathname}?switch=1`);
    } catch {
      setStatus({ type: 'error', message: 'Netwerkfout tijdens afmelden.' });
    } finally {
      setIsSwitching(false);
    }
  }, []);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const normalizedUsername = form.username.trim();
      const normalizedPassword = mode === 'login' ? form.password.trim() : form.password;

      if (!normalizedUsername || !normalizedPassword) {
        setStatus({ type: 'error', message: 'Vul gebruikersnaam en wachtwoord in.' });
        return;
      }

      if (mode === 'register') {
        const registrationError = validateRegistration(form);
        if (registrationError) {
          setStatus({ type: 'error', message: registrationError });
          return;
        }
      }

      setStatus({ type: null, message: '' });
      setIsLoading(true);

      try {
        if (mode === 'login') {
          const result = await login(normalizedUsername, normalizedPassword);

          if (!result.ok || !result.data.authenticated) {
            setStatus({ type: 'error', message: result.data.detail || 'Authenticatie mislukt.' });
            return;
          }

          clearAutoRedirectGuard();
          setStatus({ type: 'success', message: 'Succesvol ingelogd. Sessie wordt gecontroleerd...' });
          setExistingUser(typeof result.data.user === 'string' ? result.data.user : normalizedUsername);

          return;
        }

        const result = await register({
          username: form.username,
          password: form.password,
          name: form.name,
          email: form.email,
        });

        if (!result.ok) {
          setStatus({ type: 'error', message: result.data.detail || 'Registratie mislukt.' });
          return;
        }

        setStatus({ type: 'success', message: 'Account aangemaakt! Je kunt nu inloggen.' });
        setMode('login');
        setForm((previous) => ({
          ...previous,
          password: '',
          confirmPassword: '',
        }));
      } catch {
        setStatus({ type: 'error', message: 'Netwerkfout tijdens authenticatie.' });
      } finally {
        setIsLoading(false);
      }
    },
    [form, mode],
  );

  const statusIcon =
    status.type === 'error' ? <AlertCircle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />;

  return (
    <div className="auth-shell" data-density={density}>
      <UnderwaterScene density={density} reducedMotion={reducedMotion} />

      <main className="auth-layout">
        <section className="auth-panel" aria-label="Authenticatieformulier">
          <header>
            <div className="badge-row">
              <span className="auth-badge">
                <ShieldCheck size={14} aria-hidden="true" />
                Beveiligd toegangspunt
              </span>
              <span className="target-chip">TARGET · {target.returnHost}</span>
            </div>
            <h1>ChefGroep</h1>
            <p>Toegang tot het ChefGroep-platform via een beveiligde auth-gateway.</p>
          </header>

          <div className="tab-row" role="tablist" aria-label="Authenticatiemodus">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'active' : ''}
              onClick={() => onModeChange('login')}
            >
              Inloggen
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'active' : ''}
              onClick={() => onModeChange('register')}
            >
              Registreren
            </button>
          </div>

          {existingUser && (
            <section className="session-box" aria-label="Actieve sessie">
              <p>
                Sessie actief als <strong>{existingUser}</strong>.
              </p>
              <div className="session-actions">
                <button type="button" className="ghost" onClick={() => redirectTo(target.returnTo, 'assign')}>
                  Doorgaan
                </button>
                <button type="button" onClick={onSwitchAccount} disabled={isSwitching}>
                  {isSwitching ? 'Afmelden...' : 'Wissel account'}
                </button>
              </div>
            </section>
          )}

          <form onSubmit={onSubmit} noValidate>
            <AnimatePresence>
              {status.message && status.type && (
                <motion.div
                  className={`status status-${status.type}`}
                  role="alert"
                  aria-live="polite"
                  initial={reducedMotion ? false : { opacity: 0, y: -8 }}
                  animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: reducedMotion ? 0 : 0.18 }}
                >
                  {statusIcon}
                  <span>{status.message}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {mode === 'register' && (
              <>
                <InputField
                  id="name"
                  type="text"
                  label="Volledige naam"
                  placeholder="Jan de Vries"
                  value={form.name}
                  onChange={onFieldChange('name')}
                  icon={User}
                  disabled={isLoading}
                  autoComplete="name"
                />
                <InputField
                  id="email"
                  type="email"
                  label="E-mailadres"
                  placeholder="jan@chefgroep.nl"
                  value={form.email}
                  onChange={onFieldChange('email')}
                  icon={Mail}
                  disabled={isLoading}
                  autoComplete="email"
                />
              </>
            )}

            <InputField
              id="username"
              type="text"
              label="Gebruikersnaam"
              placeholder="jan"
              value={form.username}
              onChange={onFieldChange('username')}
              icon={User}
              disabled={isLoading}
              autoComplete="username"
            />
            <InputField
              id="password"
              type="password"
              label="Wachtwoord"
              placeholder="••••••••"
              value={form.password}
              onChange={onFieldChange('password')}
              icon={Lock}
              disabled={isLoading}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />

            {mode === 'register' && (
              <InputField
                id="confirmPassword"
                type="password"
                label="Bevestig wachtwoord"
                placeholder="••••••••"
                value={form.confirmPassword}
                onChange={onFieldChange('confirmPassword')}
                icon={Lock}
                disabled={isLoading}
                autoComplete="new-password"
              />
            )}

            <button type="submit" className="primary" disabled={isLoading}>
              {isLoading ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
              {mode === 'login' ? 'Inloggen' : 'Account aanmaken'}
            </button>
          </form>
        </section>

        <aside className="premium-card" aria-label="Platform informatie">
          <div className="premium-head">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Configureerbare soevereiniteit</span>
          </div>
          <h2>Jij bepaalt welke AI de agents gebruiken</h2>
          <p>
            ChefGroep levert AI-agents en systemen. Ingebouwd in elk pakket: een
            routeringslaag die bepaalt naar welke AI-providers de agents verbinding
            mogen maken. Geen maatwerk — gewoon een instelling.
          </p>
          <ul>
            <li>🌐 Volledig vrij — alle providers toegestaan</li>
            <li>🌏 Non-US — alleen Europese &amp; Aziatische AI</li>
            <li>🇪🇺 Puur Europees — uitsluitend Europese modellen</li>
            <li>⚙️ Custom — eigen whitelist van providers</li>
          </ul>
          <a href={target.returnTo} className="premium-link">
            Terug naar platform
          </a>
        </aside>
      </main>
    </div>
  );
}
