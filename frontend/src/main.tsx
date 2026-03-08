import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AuthErrorBoundary from './components/AuthErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthErrorBoundary>
      <App />
    </AuthErrorBoundary>
  </StrictMode>,
);
