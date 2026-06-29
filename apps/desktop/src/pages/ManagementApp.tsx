import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
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
import "@droidproxy/management-ui/i18n/index";

const MANAGEMENT_BASENAME = "/management";
const MANAGEMENT_FRAME_URL = "http://127.0.0.1:8418/management.html";
/** Embedded React management UI is dev-only until Tauri WebView routing is stable in production builds. */
const PREFER_EMBEDDED_MANAGEMENT = import.meta.env.DEV;

type ThemeStoreSlice = { initializeTheme: () => () => void };
type LanguageStoreSlice = { language: string; setLanguage: (language: string) => void };

class ManagementErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || "Management UI failed to render." };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ManagementApp render error", error, info);
  }

  render() {
    if (this.state.error) {
      return <ManagementFrame fallbackReason={this.state.error} />;
    }
    return this.props.children;
  }
}

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

function ManagementFrame({ fallbackReason }: { fallbackReason?: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {fallbackReason ? (
        <p className="border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          Embedded React UI unavailable ({fallbackReason}). Showing bundled management.html.
        </p>
      ) : null}
      <iframe
        title="CLI Proxy API Management Center"
        src={MANAGEMENT_FRAME_URL}
        className="min-h-0 flex-1 w-full border-0 bg-background"
      />
    </div>
  );
}

function ManagementEmbedded() {
  return (
    <ManagementErrorBoundary>
      <BrowserRouter basename={MANAGEMENT_BASENAME}>
        <Routes>
          <Route path="*" element={<ManagementShell />} />
        </Routes>
      </BrowserRouter>
    </ManagementErrorBoundary>
  );
}

export function ManagementApp() {
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [useFrame, setUseFrame] = useState(!PREFER_EMBEDDED_MANAGEMENT);

  useEffect(() => {
    if (!PREFER_EMBEDDED_MANAGEMENT) {
      setBootstrapped(true);
      return;
    }

    void restoreSession()
      .then((ok) => {
        if (!ok) setUseFrame(true);
      })
      .catch(() => setUseFrame(true))
      .finally(() => setBootstrapped(true));
  }, [restoreSession]);

  return (
    <div className="management-ui-root flex min-h-screen flex-col bg-background text-foreground">
      <ManagementBootstrap>
        <div className="border-b bg-background/90 px-4 py-3">
          <a href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            <ArrowLeft className="size-4" />
            Back to Lab
          </a>
        </div>
        {!bootstrapped ? (
          <ManagementLoading />
        ) : useFrame ? (
          <ManagementFrame />
        ) : (
          <ManagementEmbedded />
        )}
      </ManagementBootstrap>
    </div>
  );
}