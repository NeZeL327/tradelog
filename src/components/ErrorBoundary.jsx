import React from 'react';

/**
 * Error boundary – łapie błędy w drzewie komponentów i pokazuje zapasowy UI.
 * Zapobiega rozwaleniu całej aplikacji przy błędzie w jednym komponencie.
 */
export class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-800 p-4">
          <div className="max-w-md w-full rounded-2xl border border-slate-700 bg-slate-800/90 p-8 text-center">
            <h1 className="text-xl font-bold text-slate-100 mb-2">Coś poszło nie tak</h1>
            <p className="text-slate-400 text-sm mb-6">
              Wystąpił nieoczekiwany błąd. Odśwież stronę lub wróć na stronę główną.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl bg-profit hover:bg-profit text-white font-medium px-5 py-2.5 transition-colors"
              >
                Odśwież stronę
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = '/')}
                className="rounded-xl border border-slate-600 hover:bg-slate-800 text-slate-200 font-medium px-5 py-2.5 transition-colors"
              >
                Strona główna
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
