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
        <div className="w-full max-w-[380px] rounded-[20px] border border-stone-900/[0.08] bg-white p-6 text-center space-y-4">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-[#1C1C1E]">Something went wrong</h1>
            <p className="mt-1 text-xs text-[#52525B]">
              Keeper ran into an unexpected error — your household data is safe
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#1C1C1E] px-4 text-xs font-medium text-white hover:bg-[#2C2C30] transition-colors cursor-pointer"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Reload Keeper
          </button>
        </div>
      </div>
    );
  }
}
