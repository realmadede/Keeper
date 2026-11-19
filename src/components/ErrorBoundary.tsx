import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Keeper runtime error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-dvh flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[380px] rounded-[28px] border border-slate-200/80 bg-white p-6 text-center shadow-lg space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">Something went wrong</h1>
            <p className="mt-1 text-xs text-slate-500">
              Keeper ran into an unexpected error. Your household data is safe.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#1C1C1E] px-4 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Reload Keeper
          </button>
        </div>
      </div>
    );
  }
}
