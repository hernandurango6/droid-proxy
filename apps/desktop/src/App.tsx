import { ToastProvider, useToast } from "./hooks/useToast";
import { DashboardPage } from "./pages/DashboardPage";

function Toast() {
  const { message, visible } = useToast();
  return (
    <div id="toast" role="status" className={visible ? "show" : ""}>
      {message}
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <DashboardPage />
      <Toast />
    </ToastProvider>
  );
}