const API_BASE = 'https://api.chefgroep.nl';
const AUTH_HOST_SUFFIX = '.chefgroep.nl';
const DEFAULT_RETURN_TO = 'https://mc.chefgroep.nl/mission-control';

const statusBox = document.getElementById('statusBox');
const backLink = document.getElementById('backLink');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginBtn = document.getElementById('loginBtn');
const targetChip = document.getElementById('targetChip');
const sessionActions = document.getElementById('sessionActions');
const continueBtn = document.getElementById('continueBtn');
const switchBtn = document.getElementById('switchBtn');
const tabs = Array.from(document.querySelectorAll('.tab'));
const panels = Array.from(document.querySelectorAll('.panel'));
const params = new URLSearchParams(window.location.search);

function safeReturnTo() {
  const raw = params.get('return_to') || params.get('redirect') || '';
  if (!raw) return DEFAULT_RETURN_TO;
  try {
    const url = new URL(raw, window.location.origin);
    const isHttps = url.protocol === 'https:';
    const hostAllowed = url.hostname === 'chefgroep.nl' || url.hostname.endsWith(AUTH_HOST_SUFFIX);
    return isHttps && hostAllowed ? url.toString() : DEFAULT_RETURN_TO;
  } catch {
    return DEFAULT_RETURN_TO;
  }
}

const returnTo = safeReturnTo();
const returnHost = new URL(returnTo).hostname;

backLink.href = returnTo;
targetChip.textContent = `TARGET · ${returnHost}`;
targetChip.title = returnTo;

function showSessionActions(show) {
  sessionActions.classList.toggle('show', Boolean(show));
}

function setStatus(kind, text) {
  statusBox.className = `status-box show ${kind}`;
  statusBox.textContent = text;
}

function clearStatus() {
  statusBox.className = 'status-box';
  statusBox.textContent = '';
}

function activateTab(nextTab, options = {}) {
  const { focusField = false } = options;
  const panelId = nextTab?.dataset?.tab;
  if (!panelId) return;

  clearStatus();

  tabs.forEach((tab) => {
    const isActive = tab === nextTab;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });

  panels.forEach((panel) => {
    const isActive = panel.id === panelId;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });

  if (focusField) {
    const firstField = document.querySelector(`#${panelId} input, #${panelId} button`);
    firstField?.focus();
  }
}

function focusTabByOffset(currentTab, offset) {
  const currentIndex = tabs.indexOf(currentTab);
  if (currentIndex < 0) return;
  const nextIndex = (currentIndex + offset + tabs.length) % tabs.length;
  tabs[nextIndex]?.focus();
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => activateTab(tab));
  tab.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        focusTabByOffset(tab, 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        focusTabByOffset(tab, -1);
        break;
      case 'Home':
        event.preventDefault();
        tabs[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        tabs[tabs.length - 1]?.focus();
        break;
      case ' ':
      case 'Enter':
        event.preventDefault();
        activateTab(tab, { focusField: true });
        break;
      default:
        break;
    }
  });
});

async function checkExistingSession() {
  if (params.get('switch') === '1') {
    showSessionActions(false);
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/me`, { credentials: 'include' });
    if (!res.ok) return;
    const me = await res.json().catch(() => null);
    showSessionActions(true);
    setStatus('success', `Sessie actief${me?.user ? ` als ${me.user}` : ''}. Je kunt doorgaan of wisselen van account.`);
  } catch {
    // Ignore session probe failures.
  }
}

continueBtn.addEventListener('click', () => {
  window.location.href = returnTo;
});

switchBtn.addEventListener('click', async () => {
  switchBtn.disabled = true;
  continueBtn.disabled = true;
  setStatus('info', 'Sessie afmelden...');
  try {
    await fetch(`${API_BASE}/api/logout`, { method: 'POST', credentials: 'include' });
    showSessionActions(false);
    setStatus('success', 'Afgemeld. Log nu in met een ander account.');
    const url = new URL(window.location.href);
    url.searchParams.set('switch', '1');
    window.history.replaceState({}, '', url.toString());
    document.getElementById('loginUsername')?.focus();
  } catch {
    setStatus('error', 'Afmelden mislukt. Probeer opnieuw.');
  } finally {
    switchBtn.disabled = false;
    continueBtn.disabled = false;
  }
});

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const username = (form.username.value || '').trim();
  const password = form.password.value || '';

  if (!username || !password) {
    setStatus('error', 'Vul gebruikersnaam en wachtwoord in.');
    return;
  }

  loginBtn.disabled = true;
  showSessionActions(false);
  setStatus('info', `Authenticatie bezig... Je wordt doorgestuurd naar ${returnHost}`);

  try {
    const res = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus('error', data.detail || 'Authenticatie mislukt.');
      return;
    }

    setStatus('success', `Ingelogd als ${data.user || username}. Doorsturen...`);
    window.setTimeout(() => {
      window.location.href = returnTo;
    }, 300);
  } catch {
    setStatus('error', 'Netwerkfout tijdens inloggen. Probeer opnieuw.');
  } finally {
    loginBtn.disabled = false;
  }
}

function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const name = form.name.value;
  const email = form.email.value;
  setStatus('info', `Access request ontvangen voor ${name || email}. Gebruik voorlopig een bestaand account in Mission Control.`);
}

loginForm.addEventListener('submit', handleLogin);
registerForm.addEventListener('submit', handleRegister);

checkExistingSession();
