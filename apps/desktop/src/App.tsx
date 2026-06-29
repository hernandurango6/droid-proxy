import { DashboardPage } from "@/pages/DashboardPage";
import { Toaster } from "@/components/ui/sonner";

export function App() {
  return (
    <>
      <DashboardPage />
      <Toaster richColors closeButton position="bottom-right" />
    </>
  );
}