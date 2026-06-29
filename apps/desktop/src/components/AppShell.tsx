import { BarChart3, FileKey, LayoutDashboard, RefreshCw, Settings, ScrollText } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { droidproxy } from "@/lib/tauri";

interface AppShellProps {
  endpoint: string;
  onRefresh: () => void;
  children: ReactNode;
}

const MANAGEMENT_SECTIONS = [
  { label: "Overview", hash: "#/", icon: LayoutDashboard },
  { label: "Quota", hash: "#/quota", icon: BarChart3 },
  { label: "Auth Files", hash: "#/auth-files", icon: FileKey },
  { label: "Config", hash: "#/config", icon: Settings },
  { label: "Logs", hash: "#/logs", icon: ScrollText }
] as const;

function managementLink(hash: string) {
  return { pathname: "/management", hash };
}

export function AppShell({ endpoint, onRefresh, children }: AppShellProps) {
  const location = useLocation();
  const onHome = location.pathname === "/";
  const inManagement = location.pathname.startsWith("/management");
  const currentHash = location.hash || "#/";

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
        <nav className="mx-auto flex max-w-7xl flex-wrap gap-2 px-4 py-2">
          <Link
            to="/"
            className={cn(
              buttonVariants({ variant: onHome ? "secondary" : "outline", size: "sm" })
            )}
          >
            <LayoutDashboard className="size-4" />
            Home
          </Link>
          <Link
            to="/settings"
            className={cn(
              buttonVariants({
                variant: location.pathname === "/settings" ? "secondary" : "outline",
                size: "sm"
              })
            )}
          >
            <Settings className="size-4" />
            Settings
          </Link>
          {MANAGEMENT_SECTIONS.map((section) => {
            const href = managementLink(section.hash);
            const active =
              inManagement &&
              (section.hash === "#/"
                ? currentHash === "#/" || currentHash === ""
                : currentHash === section.hash);
            const Icon = section.icon;
            return (
              <Link
                key={section.hash}
                to={href}
                className={cn(
                  buttonVariants({ variant: active ? "secondary" : "outline", size: "sm" })
                )}
              >
                <Icon className="size-4" />
                {section.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}