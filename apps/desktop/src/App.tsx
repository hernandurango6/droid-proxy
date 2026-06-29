import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DashboardPage } from "@/pages/DashboardPage";
import { ManagementQuotaPage } from "@/pages/ManagementQuotaPage";
import { Toaster } from "@/components/ui/sonner";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/management/*" element={<ManagementQuotaPage />} />
      </Routes>
      <Toaster richColors closeButton position="bottom-right" />
    </BrowserRouter>
  );
}