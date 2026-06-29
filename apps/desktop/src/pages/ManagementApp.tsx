import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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

const MANAGEMENT_BASENAME = "/management";

type ThemeStoreSlice = { initializeTheme: () => () => void };
type LanguageStoreSlice = { language: string; setLanguage: (language: string) => void };

function ManagementShell() {
  return (
    <>
      <NotificationContainer />
      <ConfirmationModal />
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    </>
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
          <a href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            <ArrowLeft className="size-4" />
            Back to Lab
          </a>
        </div>
        {!bootstrapped ? (
          <ManagementLoading />
        ) : (
          <BrowserRouter basename={MANAGEMENT_BASENAME}>
            <Routes>
              <Route path="*" element={<ManagementShell />} />
            </Routes>
          </BrowserRouter>
        )}
      </ManagementBootstrap>
    </div>
  );
}