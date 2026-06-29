import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { HashRouter, Navigate, Route, Routes, Link } from "react-router-dom";
import { QuotaPage } from "@droidproxy/management-ui/pages/QuotaPage";
import { NotificationContainer } from "@droidproxy/management-ui/components/common/NotificationContainer";
import { LoadingSpinner } from "@droidproxy/management-ui/components/ui/LoadingSpinner";
import { useAuthStore } from "@/management/adapter/useAuthStore.shim";
import { useThemeStore } from "@droidproxy/management-ui/stores/useThemeStore";
import { useLanguageStore } from "@droidproxy/management-ui/stores/useLanguageStore";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "@droidproxy/management-ui/styles/global.scss";
import "@droidproxy/management-ui/i18n/index";

type ThemeStoreSlice = { initializeTheme: () => () => void };
type LanguageStoreSlice = { language: string; setLanguage: (language: string) => void };

function ManagementBootstrap({ children }: { children: React.ReactNode }) {
  const initializeTheme = useThemeStore((state: ThemeStoreSlice) => state.initializeTheme);
  const language = useLanguageStore((state: LanguageStoreSlice) => state.language);
  const setLanguage = useLanguageStore((state: LanguageStoreSlice) => state.setLanguage);

  useEffect(() => {
    const cleanupTheme = initializeTheme();
    return cleanupTheme;
  }, [initializeTheme]);

  useEffect(() => {
    setLanguage(language);
  }, [language, setLanguage]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return <>{children}</>;
}

function QuotaRoute() {
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const connectionError = useAuthStore((state) => state.connectionError);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  if (connectionStatus === "disconnected" || connectionStatus === "connecting") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (connectionStatus === "error") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6">
        <p className="font-medium text-destructive">Management connection failed</p>
        <p className="mt-2 text-sm text-muted-foreground">{connectionError}</p>
        <button
          type="button"
          className={cn(buttonVariants({ size: "sm" }), "mt-4")}
          onClick={() => void restoreSession()}
        >
          <RefreshCw className="size-4" />
          Retry
        </button>
      </div>
    );
  }

  return <QuotaPage />;
}

export function ManagementQuotaPage() {
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    void restoreSession().finally(() => setBootstrapped(true));
  }, [restoreSession]);

  return (
    <div className="management-ui-root min-h-screen bg-background">
      <ManagementBootstrap>
        <NotificationContainer />
        <div className="border-b bg-background/90 px-4 py-3">
          <Link
            to="/"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <ArrowLeft className="size-4" />
            Back to Lab
          </Link>
        </div>
        <div className="px-4 py-4">
          {!bootstrapped ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <HashRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/quota" replace />} />
                <Route path="/quota" element={<QuotaRoute />} />
                <Route path="*" element={<Navigate to="/quota" replace />} />
              </Routes>
            </HashRouter>
          )}
        </div>
      </ManagementBootstrap>
    </div>
  );
}