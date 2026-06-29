import { BarChart3, LayoutDashboard, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { droidproxy } from "@/lib/tauri";

interface AppShellProps {
  endpoint: string;
  onRefresh: () => void;
  children: ReactNode;
}

export function AppShell({ endpoint, onRefresh, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              DroidProxy Desktop
            </p>
            <h1 className="text-xl font-semibold">Lab Control</h1>
            <p className="font-mono text-xs text-muted-foreground">{endpoint || "Loading endpoint..."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void onRefresh()}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void droidproxy.supervisor.restart().then(() => {
                  toast.success("Services restarted");
                  onRefresh();
                });
              }}
            >
              Restart services
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(endpoint);
                toast.success("Endpoint copied");
              }}
            >
              Copy endpoint
            </Button>
          </div>
        </div>
        <Separator />
        <nav className="mx-auto flex max-w-7xl gap-2 px-4 py-2">
          <Button variant="secondary" size="sm">
            <LayoutDashboard className="size-4" />
            Home
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void droidproxy.management.openWebview().catch((error) => {
                toast.error(String(error));
              });
            }}
          >
            <BarChart3 className="size-4" />
            Quota (Management)
          </Button>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}