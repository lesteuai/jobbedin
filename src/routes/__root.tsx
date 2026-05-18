import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { AppStoreProvider } from "@/lib/app-store";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="ym-window" style={{ maxWidth: 400 }}>
        <div className="ym-titlebar">
          <span>⚠ JobbedIn</span>
          <div className="ym-titlebar-glow" />
        </div>
        <div style={{ padding: 20, textAlign: "center" }}>
          <h1 style={{ fontSize: 48, fontWeight: "bold" }}>404</h1>
          <p style={{ margin: "8px 0 16px" }}>Page not found, buddy.</p>
          <Link to="/" className="ym-btn ym-btn-primary" style={{ textDecoration: "none" }}>
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="ym-window" style={{ maxWidth: 460 }}>
        <div className="ym-titlebar">
          <span>⚠ Error</span>
          <div className="ym-titlebar-glow" />
        </div>
        <div style={{ padding: 20 }}>
          <p>Something went wrong.</p>
          <pre style={{ fontSize: 11, color: "#a33", whiteSpace: "pre-wrap" }}>
            {error.message}
          </pre>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button
              className="ym-btn ym-btn-primary"
              onClick={() => {
                router.invalidate();
                reset();
              }}
            >
              Try again
            </button>
            <a href="/" className="ym-btn" style={{ textDecoration: "none" }}>
              Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AppStoreProvider>
        <Outlet />
      </AppStoreProvider>
    </QueryClientProvider>
  );
}
