import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { EmptyState } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
            <SidebarTrigger />
            <span className="font-semibold">Northwind Traders</span>
          </header>
          {/* SidebarInset is the page's <main>; this only sets its width. */}
          <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
            <Outlet />
          </div>
          <footer className="text-muted-foreground mx-auto w-full max-w-6xl px-4 pb-8 text-xs md:px-8">
            <Link to="/privacy" className="hover:underline">
              Privacy
            </Link>
          </footer>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}

function NotFound() {
  return (
    <EmptyState
      titleLevel={1}
      title="This page does not exist."
      description="Check the address, or start again from the product list."
      action={
        <Button asChild>
          <Link to="/products">Go to products</Link>
        </Button>
      }
    />
  );
}
