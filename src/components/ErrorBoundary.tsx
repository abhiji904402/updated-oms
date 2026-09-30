import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Critical Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070913] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-[#0d1020] border border-rose-500/40 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <span className="text-2xl">⚠️</span>
              <h2 className="text-xl font-bold">Broomies Bakery OMS Recovery System</h2>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              An unexpected render error occurred. You can restore default state or reload the app:
            </p>
            <pre className="bg-[#060810] p-4 rounded-xl text-rose-300 text-xs overflow-auto max-h-60 border border-slate-800 whitespace-pre-wrap font-mono mb-4">
              {this.state.error?.toString()}
              {'\n'}
              {this.state.errorInfo?.componentStack}
            </pre>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem('broomies_orders_v4');
                    localStorage.removeItem('broomies_auth_v1');
                  } catch (e) {}
                  window.location.reload();
                }}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-rose-900/40"
              >
                Reset Local Cache & Reload
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
              >
                Reload Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
