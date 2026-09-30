import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface SafeErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface SafeErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class SafeErrorBoundary extends Component<SafeErrorBoundaryProps, SafeErrorBoundaryState> {
  public override state: SafeErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): SafeErrorBoundaryState {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[SafeErrorBoundary] Caught error:', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[350px] p-6 text-center">
          <div className="max-w-md w-full bg-slate-900/90 border border-red-500/30 rounded-2xl p-6 shadow-2xl backdrop-blur-sm text-slate-100">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto mb-4 text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-100 mb-1">
              {this.props.fallbackTitle || 'Safe Page Shield'}
            </h3>

            <p className="text-sm text-slate-400 mb-4 leading-relaxed">
              An unexpected error occurred while rendering this section. Data remains safe and untouched.
            </p>

            {this.state.error?.message && (
              <div className="mb-5 p-3 rounded-lg bg-slate-950 border border-slate-800 text-left overflow-x-auto">
                <p className="text-xs font-mono text-red-400 break-words line-clamp-3">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-xs font-semibold shadow-md shadow-purple-600/20 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry View
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all cursor-pointer"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SafeErrorBoundary;
