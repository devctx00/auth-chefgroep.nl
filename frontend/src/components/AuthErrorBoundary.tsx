import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; errorMessage: string };

export default class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      event: 'app.error_boundary',
      message: error.message,
      componentStack: info.componentStack,
    }));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            color: '#e2eefb',
            background: '#020916',
            fontFamily: 'IBM Plex Sans, Segoe UI, sans-serif',
          }}
        >
          <h1 style={{ marginBottom: '0.75rem' }}>Er is iets misgegaan</h1>
          <p style={{ color: '#97b6d5', maxWidth: '400px', textAlign: 'center' }}>
            Vernieuw de pagina of probeer het later opnieuw. Als het probleem aanhoudt, neem dan
            contact op met de beheerder.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.5rem',
              borderRadius: '14px',
              border: 0,
              background: 'linear-gradient(120deg, #2dd4bf, #0ea5e9)',
              color: '#042f2e',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Pagina vernieuwen
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
