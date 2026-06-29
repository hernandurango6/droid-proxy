import { useEffect, useState, type ReactElement } from "react";
import { RefreshCw } from "lucide-react";
import { LoadingSpinner } from "@droidproxy/management-ui/components/ui/LoadingSpinner";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "./useAuthStore.shim";

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const connectionError = useAuthStore((state) => state.connectionError);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const [bootstrapping, setBootstrapping] = useState(false);

  useEffect(() => {
    if (isAuthenticated || connectionStatus === "connecting" || bootstrapping) {
      return;
    }

    setBootstrapping(true);
    void restoreSession().finally(() => setBootstrapping(false));
  }, [bootstrapping, connectionStatus, isAuthenticated, restoreSession]);

  if (
    bootstrapping ||
    connectionStatus === "connecting" ||
    connectionStatus === "disconnected"
  ) {
    return (
      <div className="main-content flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (connectionStatus === "error" || !isAuthenticated) {
    return (
      <div className="main-content mx-auto max-w-lg p-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6">
          <p className="font-medium text-destructive">Management connection failed</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {connectionError || "Unable to reach the local management API."}
          </p>
          <button
            type="button"
            className={cn(buttonVariants({ size: "sm" }), "mt-4")}
            onClick={() => void restoreSession()}
          >
            <RefreshCw className="size-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return children;
}