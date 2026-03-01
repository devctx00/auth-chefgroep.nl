import { useEffect, useMemo, useRef, useState, type ElementType, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Crown,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react';
import { login, logout, me, register } from './lib/authApi';
import { getReturnTarget, redirectTo, validateRegistration, type AuthMode } from './lib/authContract';
import { useDensity, type Density } from './hooks/useDensity';

type StatusType = 'error' | 'success' | 'info' | null;

type FormState = {
  username: string;
  password: string;
  confirmPassword: string;
  name: string;
  email: string;
};

const AUTO_REDIRECT_GUARD_KEY = 'auth:auto-redirect-guard';
const AUTO_REDIRECT_GUARD_WINDOW_MS = 15_000;

function hasRecentAutoRedirect(target: string): boolean {
  try {
    const raw = window.sessionStorage.getItem(AUTO_REDIRECT_GUARD_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { target?: string; at?: number };
    if (parsed.target !== target || typeof parsed.at !== 'number') return false;
    return Date.now() - parsed.at < AUTO_REDIRECT_GUARD_WINDOW_MS;
  } catch {
    return false;
  }
}

function markAutoRedirect(target: string): void {
  try {
    window.sessionStorage.setItem(
      AUTO_REDIRECT_GUARD_KEY,
      JSON.stringify({ target, at: Date.now() }),
    );
  } catch {
    // Ignore storage failures.
  }
}

function UnderwaterScene({ density, reducedMotion }: { density: Density; reducedMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const particlesByDensity: Record<Density, number> = {
      compact: 12,
      comfortable: 20,
      relaxed: 30,
    };

    type Bubble = { x: number; y: number; radius: number; speed: number; drift: number };

    let width = 0;
    let height = 0;
    let frameId = 0;
    let bubbles: Bubble[] = [];

    const createBubble = (): Bubble => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 1 + Math.random() * 4,
      speed: 0.2 + Math.random() * 0.6,
      drift: (Math.random() - 0.5) * 0.4,
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      bubbles = Array.from({ length: particlesByDensity[density] }, createBubble);
    };

    const drawFrame = () => {
      const gradient = context.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#03132d');
      gradient.addColorStop(0.55, '#041f3d');
      gradient.addColorStop(1, '#020916');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      context.globalAlpha = 0.14;
      context.fillStyle = '#67e8f9';
      context.beginPath();
      context.ellipse(width * 0.2, height * 0.15, width * 0.32, 90, 0, 0, Math.PI * 2);
      context.fill();

      context.globalAlpha = 1;
      for (const bubble of bubbles) {
        context.beginPath();
        context.fillStyle = 'rgba(186,230,253,0.42)';
        context.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        context.fill();

        if (!reducedMotion) {
          bubble.y -= bubble.speed;
          bubble.x += bubble.drift;

          if (bubble.y + bubble.radius < 0 || bubble.x < -20 || bubble.x > width + 20) {
            bubble.x = Math.random() * width;
            bubble.y = height + 8;
          }
        }
      }

      if (!reducedMotion) {
        frameId = window.requestAnimationFrame(drawFrame);
      }
    };

    resize();
    drawFrame();

    const onResize = () => {
      resize();
      if (reducedMotion) {
        drawFrame();
      }
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
    };
  }, [density, reducedMotion]);

  return <canvas ref={canvasRef} className="underwater-canvas" aria-hidden="true" />;
}

function InputField({
  id,
  type,
  label,
  placeholder,
  value,
  onChange,
  icon,
  disabled,
  autoComplete,
}: {
  id: string;
  type: 'text' | 'email' | 'password';
  label: string;
  placeholder: string;
  value: string;
  onChange: (nextValue: string) => void;
  icon: ElementType;
  disabled: boolean;
  autoComplete: string;
}) {
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
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Verberg invoer' : 'Toon invoer'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

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
    if (target.switchRequested) {
      return;
    }

    let active = true;

    void me()
      .then((result) => {
        if (!active || !result.ok) {
          return;
        }

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
    if (!existingUser || target.switchRequested || isSwitching) {
      return;
    }

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

  const onFieldChange = (field: keyof FormState) => (value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (status.type === 'error') {
      setStatus({ type: null, message: '' });
    }
  };

  const onModeChange = (nextMode: AuthMode) => {
    setMode(nextMode);
    setStatus({ type: null, message: '' });
  };

  const onSwitchAccount = async () => {
    setIsSwitching(true);
    setStatus({ type: 'info', message: 'Sessie wordt afgemeld...' });

    try {
      const result = await logout();

      if (!result.ok) {
        setStatus({ type: 'error', message: result.data.detail || 'Afmelden mislukt.' });
        return;
      }

      setExistingUser(null);
      setStatus({ type: 'success', message: 'Afgemeld. Log nu in met een ander account.' });
      window.history.replaceState({}, '', `${window.location.pathname}?switch=1`);
    } catch {
      setStatus({ type: 'error', message: 'Netwerkfout tijdens afmelden.' });
    } finally {
      setIsSwitching(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.username || !form.password) {
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
        const result = await login(form.username, form.password);

        if (!result.ok || !result.data.authenticated) {
          setStatus({ type: 'error', message: result.data.detail || 'Authenticatie mislukt.' });
          return;
        }

        setStatus({ type: 'success', message: 'Succesvol ingelogd. Je wordt doorgestuurd...' });
        window.setTimeout(() => {
          redirectTo(target.returnTo, 'assign');
        }, 800);

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
  };

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
            <h1>Prime Command</h1>
            <p>Log in op de ChefGroep-controlplane via een strikte same-origin API-route.</p>
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

        <aside className="premium-card" aria-label="Premium veiligheid">
          <div className="premium-head">
            <Crown size={18} aria-hidden="true" />
            <span>Premium Security Card</span>
          </div>
          <h2>Worker-backed auth gateway</h2>
          <p>
            Frontend en backend zijn strikt gescheiden: de browser praat alleen met <code>/api</code>,
            terwijl de worker veilig proxyt naar de auth API.
          </p>
          <ul>
            <li>Same-origin sessiecookies</li>
            <li>Geen runtime legacy script pad</li>
            <li>Reduced-motion en adaptive density inbegrepen</li>
          </ul>
          <a href={target.returnTo} className="premium-link">
            Terug naar doelapp
          </a>
        </aside>
      </main>
    </div>
  );
}
