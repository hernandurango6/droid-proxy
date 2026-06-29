import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Link,
  Outlet,
  RouterProvider,
  createHashRouter
} from "react-router-dom";
import { ConfirmationModal } from "@droidproxy/management-ui/components/common/ConfirmationModal";
import { NotificationContainer } from "@droidproxy/management-ui/components/common/NotificationContainer";
import { MainLayout } from "@droidproxy/management-ui/components/layout/MainLayout";
import { LoadingSpinner } from "@droidproxy/management-ui/components/ui/LoadingSpinner";
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

const managementRouter = createHashRouter([
  {
    element: <RootShell />,
    children: [
      {
        path: "/*",
        element: (
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        )
      }
    ]
  }
]);

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

export function ManagementApp() {
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const [bootstrapped, setBootstrapped] = useState(false);
  const router = useMemo(() => managementRouter, []);

  useEffect(() => {
    void restoreSession().finally(() => setBootstrapped(true));
  }, [restoreSession]);

  return (
    <div className="management-ui-root min-h-screen bg-background">
      <ManagementBootstrap>
        <div className="border-b bg-background/90 px-4 py-3">
          <Link
            to="/"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <ArrowLeft className="size-4" />
            Back to Lab
          </Link>
        </div>
        {!bootstrapped ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <RouterProvider router={router} />
        )}
      </ManagementBootstrap>
    </div>
  );
}