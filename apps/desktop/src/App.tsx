import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DashboardPage } from "@/pages/DashboardPage";
import { ManagementApp } from "@/pages/ManagementApp";
import { Toaster } from "@/components/ui/sonner";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/management/*" element={<ManagementApp />} />
      </Routes>
      <Toaster richColors closeButton position="bottom-right" />
    </BrowserRouter>
  );
}