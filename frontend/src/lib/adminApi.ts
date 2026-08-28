const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "UNKNOWN_ERROR" }));
    throw new ApiError(res.status, body.error ?? "UNKNOWN_ERROR");
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface AdminLoginResult {
  mfaRequired: boolean;
  email?: string;
}

export function adminLogin(email: string, password: string): Promise<AdminLoginResult> {
  return request("/admin/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function adminMfaChallenge(code: string): Promise<{ email: string }> {
  return request("/admin/auth/mfa/challenge", { method: "POST", body: JSON.stringify({ code }) });
}

export function adminLogout(): Promise<void> {
  return request("/admin/auth/logout", { method: "POST" });
}

export function adminMe(): Promise<{ email: string; mfaEnabled: boolean }> {
  return request("/admin/auth/me");
}

export function adminForgotPassword(email: string): Promise<{ ok: boolean }> {
  return request("/admin/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
}

export function adminResetPassword(token: string, newPassword: string): Promise<{ ok: boolean }> {
  return request("/admin/auth/reset-password", { method: "POST", body: JSON.stringify({ token, newPassword }) });
}

export function adminMfaSetup(): Promise<{ qrCodeDataUrl: string; secret: string }> {
  return request("/admin/auth/mfa/setup", { method: "POST" });
}

export function adminMfaVerifySetup(code: string): Promise<{ mfaEnabled: boolean }> {
  return request("/admin/auth/mfa/verify-setup", { method: "POST", body: JSON.stringify({ code }) });
}

export function adminMfaDisable(code: string): Promise<{ mfaEnabled: boolean }> {
  return request("/admin/auth/mfa/disable", { method: "POST", body: JSON.stringify({ code }) });
}

export interface SecurityAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  companyName: string | null;
  resolved: boolean;
  createdAt: string;
}

export function listSecurityAlerts(resolved: "false" | "true" | "all" = "false"): Promise<{ alerts: SecurityAlert[] }> {
  return request(`/admin/security-alerts?resolved=${resolved}`);
}

export function resolveSecurityAlert(id: string): Promise<{ id: string; resolved: boolean }> {
  return request(`/admin/security-alerts/${id}/resolve`, { method: "POST" });
}

export interface BackupEntry {
  file: string;
  sizeBytes: number;
  createdAt: string;
}

export function listBackups(): Promise<{ backups: BackupEntry[] }> {
  return request("/admin/backups");
}

export function runBackupNow(): Promise<{ file: string; sizeBytes: number }> {
  return request("/admin/backups/run-now", { method: "POST" });
}

export interface AdminCompany {
  id: string;
  name: string;
  slug: string;
  status: string;
  accentColor: string;
  joinToken: string;
  customersCount: number;
  transactionsCount: number;
  createdAt: string;
}

export function listAdminCompanies(): Promise<{ companies: AdminCompany[] }> {
  return request("/admin/companies");
}

export interface CreateCompanyInput {
  name: string;
  slug?: string;
  accentColor?: string;
  programName?: string;
}

export interface CreateCompanyResponse {
  id: string;
  name: string;
  slug: string;
  joinToken: string;
  joinUrl: string;
}

export function createAdminCompany(input: CreateCompanyInput): Promise<CreateCompanyResponse> {
  return request("/admin/companies", { method: "POST", body: JSON.stringify(input) });
}

export async function deleteAdminCompany(id: string): Promise<void> {
  await request(`/admin/companies/${id}`, { method: "DELETE" });
}

export function qrCodeUrl(joinToken: string): string {
  return `${API_BASE_URL}/join/${encodeURIComponent(joinToken)}/qrcode.png`;
}

export interface CompanyDetail {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  programName: string;
  accentColor: string;
  secondaryColor: string | null;
  cardTemplate: "BANNER" | "GRADIENT" | "FRAME" | "SPLIT";
  pointsPerCurrencyUnit: string;
  status: string;
  joinToken: string;
}

export function getAdminCompany(id: string): Promise<CompanyDetail> {
  return request(`/admin/companies/${id}`);
}

export interface UpdateCompanyInput {
  name?: string;
  programName?: string;
  accentColor?: string;
  secondaryColor?: string;
  cardTemplate?: "BANNER" | "GRADIENT" | "FRAME" | "SPLIT";
  pointsPerCurrencyUnit?: string;
}

export function updateAdminCompany(id: string, input: UpdateCompanyInput): Promise<CompanyDetail> {
  return request(`/admin/companies/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export interface CreateEmployeeInput {
  name: string;
  email: string;
  role?: "ADMIN" | "MANAGER" | "EMPLOYEE";
}

export interface CreateEmployeeResponse {
  name: string;
  email: string;
  role: string;
  temporaryPassword: string;
  loginUrl: string;
}

export function createCompanyEmployee(
  companyId: string,
  input: CreateEmployeeInput,
): Promise<CreateEmployeeResponse> {
  return request(`/admin/companies/${companyId}/employees`, { method: "POST", body: JSON.stringify(input) });
}

export function suspendCompany(id: string): Promise<{ id: string; status: string }> {
  return request(`/admin/companies/${id}/suspend`, { method: "POST" });
}

export function reactivateCompany(id: string): Promise<{ id: string; status: string }> {
  return request(`/admin/companies/${id}/reactivate`, { method: "POST" });
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorType: string;
  actorLabel: string | null;
  companyName: string | null;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
}

export function listAuditLogs(): Promise<{ logs: AuditLogEntry[] }> {
  return request("/admin/audit-logs");
}

export async function uploadCompanyLogo(id: string, file: File): Promise<{ logoUrl: string }> {
  const formData = new FormData();
  formData.append("logo", file);

  const res = await fetch(`${API_BASE_URL}/admin/companies/${id}/logo`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "UNKNOWN_ERROR" }));
    throw new ApiError(res.status, body.error ?? "UNKNOWN_ERROR");
  }

  return res.json();
}
