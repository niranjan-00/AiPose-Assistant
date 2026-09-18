import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("AiPose ErrorBoundary caught:", error, info);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="max-w-md text-sm text-white/70">
            An unexpected error occurred. Try reloading the page. If the problem
            persists, your browser may not support all features of AiPose
            (camera, WebGL, or TensorFlow.js).
          </p>
          <pre className="max-w-md overflow-auto rounded-lg bg-white/5 p-3 text-xs text-white/60">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-lime-300 px-6 py-3 text-sm font-semibold text-black"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
