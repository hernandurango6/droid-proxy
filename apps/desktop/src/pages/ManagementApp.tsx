import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { HashRouter, Link, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { ConfirmationModal } from "@droidproxy/management-ui/components/common/ConfirmationModal";
import { NotificationContainer } from "@droidproxy/management-ui/components/common/NotificationContainer";
import { MainLayout } from "@droidproxy/management-ui/components/layout/MainLayout";
import { useLanguageStore } from "@droidproxy/management-ui/stores/useLanguageStore";
import { useThemeStore } from "@droidproxy/management-ui/stores/useThemeStore";
import { ProtectedRoute } from "@/management/adapter/ProtectedRoute.shim";
import { useAuthStore } from "@/management/adapter/useAuthStore.shim";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "@droidproxy/management-ui/styles/global.scss";
import "@droidproxy/management-ui/i18n/index";

type ThemeStoreSlice = { initializeTheme: () => () => void };
type LanguageStoreSlice = { language: string; setLanguage: (language: string) => void };

function RootShell() {
  return (
    <>
      <NotificationContainer />
      <ConfirmationModal />
      <Outlet />
    </>
  );
}

function ManagementRoutes() {
  return (
    <Routes>
      <Route element={<RootShell />}>
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}

function ManagementBootstrap({ children }: { children: ReactNode }) {
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

/** Hash routes under /management need a non-empty fragment for the nested HashRouter. */
function useEnsureManagementHash() {
  const location = useLocation();

  useEffect(() => {
    if (!location.pathname.startsWith("/management")) {
      return;
    }

    const hash = window.location.hash.replace(/^#/, "");
    if (!hash || hash === "/") {
      if (window.location.hash !== "#/") {
        window.location.hash = "#/";
      }
    }
  }, [location.pathname, location.key]);
}

function ManagementLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <div
        className="size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
        role="status"
        aria-live="polite"
      />
      <p>Connecting to Management Center…</p>
    </div>
  );
}

export function ManagementApp() {
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    void restoreSession().finally(() => setBootstrapped(true));
  }, [restoreSession]);

  return (
    <div className="management-ui-root min-h-screen bg-background text-foreground">
      <ManagementBootstrap>
        <div className="border-b bg-background/90 px-4 py-3">
          <Link to="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            <ArrowLeft className="size-4" />
            Back to Lab
          </Link>
        </div>
        {!bootstrapped ? (
          <ManagementLoading />
        ) : (
          <HashRouter>
            <ManagementHashBootstrap>
              <ManagementRoutes />
            </ManagementHashBootstrap>
          </HashRouter>
        )}
      </ManagementBootstrap>
    </div>
  );
}

function ManagementHashBootstrap({ children }: { children: ReactNode }) {
  useEnsureManagementHash();
  return <>{children}</>;
}