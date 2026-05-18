import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { AppStoreProvider } from "@/lib/app-store";

import appCss from "../styles.css?url";

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
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "JobbedIn — Yahoo-style Job Helper" },
      { name: "description", content: "Resume + job analysis in classic Y!M style." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

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
