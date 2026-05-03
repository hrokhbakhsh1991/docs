"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button, Card, CardBody, CardHeader, CardTitle } from "@tour/ui";

type Props = {
  children: ReactNode;
};

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <Card role="alert">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
          </CardHeader>
          <CardBody>
            <p style={{ marginTop: 0 }}>
              We hit an unexpected problem. You can try again without reloading the whole app.
            </p>
            <p style={{ marginTop: "var(--space-2)", color: "var(--color-text-secondary)" }}>
              {this.state.error.message || "Unexpected application error."}
            </p>
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <Button type="button" variant="primary" onClick={this.reset}>
                Try again
              </Button>
              <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
                Reload page
              </Button>
            </div>
          </CardBody>
        </Card>
      );
    }
    return this.props.children;
  }
}
