import { createRootRoute, createRoute, createRouter, Link, Outlet } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

function RootLayout() {
  return <Outlet />;
}

function AdminHomePage() {
  return (
    <main className="flex min-h-screen bg-muted/40">
      <aside className="flex w-64 flex-col border-r bg-background px-4 py-5">
        <div className="text-lg font-semibold">Web Admin Base</div>
        <nav className="mt-6 flex flex-col gap-2 text-sm">
          <Link className="rounded-md bg-secondary px-3 py-2 text-secondary-foreground" to="/">
            Dashboard
          </Link>
        </nav>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-background px-6">
          <div className="text-sm text-muted-foreground">Dashboard</div>
          <Button variant="outline" size="sm">
            Health
          </Button>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-6">
          <div>
            <h1 className="text-2xl font-semibold">Admin Foundation</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              This shell is ready for future base-system modules without including example business
              modules.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <section className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Authentication will be implemented later.</p>
      </section>
    </main>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: AdminHomePage
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage
});

const routeTree = rootRoute.addChildren([indexRoute, loginRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
