import { Navigate, Route, Routes } from "react-router-dom";
import { JoinPage } from "./pages/JoinPage";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminForgotPasswordPage } from "./pages/AdminForgotPasswordPage";
import { AdminResetPasswordPage } from "./pages/AdminResetPasswordPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AdminCompanyEditPage } from "./pages/AdminCompanyEditPage";
import { AdminAuditLogsPage } from "./pages/AdminAuditLogsPage";
import { AdminSecurityPage } from "./pages/AdminSecurityPage";
import { CompanyLoginPage } from "./pages/CompanyLoginPage";
import { CompanyForgotPasswordPage } from "./pages/CompanyForgotPasswordPage";
import { CompanyResetPasswordPage } from "./pages/CompanyResetPasswordPage";
import { CompanyDashboardPage } from "./pages/CompanyDashboardPage";
import { CompanyEmployeesPage } from "./pages/CompanyEmployeesPage";
import { CompanyCustomersPage } from "./pages/CompanyCustomersPage";
import { CompanyProgramPage } from "./pages/CompanyProgramPage";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
import { ScanPage } from "./pages/ScanPage";

export default function App() {
  return (
    <Routes>
      <Route path="/join/:companyToken" element={<JoinPage />} />
      <Route path="/join" element={<CenteredNotice />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/forgot-password" element={<AdminForgotPasswordPage />} />
      <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
      <Route path="/admin/security" element={<AdminSecurityPage />} />
      <Route path="/admin/companies/:id" element={<AdminCompanyEditPage />} />
      <Route path="/company/:slug/login" element={<CompanyLoginPage />} />
      <Route path="/company/:slug/forgot-password" element={<CompanyForgotPasswordPage />} />
      <Route path="/company/:slug/reset-password" element={<CompanyResetPasswordPage />} />
      <Route path="/company/:slug" element={<CompanyDashboardPage />} />
      <Route path="/company/:slug/employees" element={<CompanyEmployeesPage />} />
      <Route path="/company/:slug/customers" element={<CompanyCustomersPage />} />
      <Route path="/company/:slug/customers/:customerId" element={<CustomerDetailPage />} />
      <Route path="/company/:slug/program" element={<CompanyProgramPage />} />
      <Route path="/company/:slug/scan" element={<ScanPage />} />
      <Route path="*" element={<Navigate to="/join" replace />} />
    </Routes>
  );
}

function CenteredNotice() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center text-sm text-black/50">
      Ce lien nécessite un code d'entreprise (scannez le QR code affiché en boutique).
    </div>
  );
}
