import { Component, type ErrorInfo, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { en } from '../../i18n/en';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Pixavelo render failure', {
        error: error.message,
        componentStack: info.componentStack
      });
    }
  }

  public render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="fatal-error">
        <TriangleAlert size={32} aria-hidden="true" />
        <h1>Pixavelo needs to restart this view</h1>
        <p>Your source files remain on your device and were not uploaded.</p>
        <button
          className="button button--primary"
          type="button"
          onClick={() => window.location.reload()}
        >
          {en.actions.tryAgain}
        </button>
      </main>
    );
  }
}
