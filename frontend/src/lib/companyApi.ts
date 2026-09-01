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

export function companyLogin(slug: string, email: string, password: string): Promise<{ name: string; role: string }> {
  return request(`/company/${slug}/auth/login`, { method: "POST", body: JSON.stringify({ email, password }) });
}

export function companyLogout(slug: string): Promise<void> {
  return request(`/company/${slug}/auth/logout`, { method: "POST" });
}

export function companyMe(slug: string): Promise<{ id: string; name: string; role: string }> {
  return request(`/company/${slug}/auth/me`);
}

export function companyForgotPassword(slug: string, email: string): Promise<{ ok: boolean }> {
  return request(`/company/${slug}/auth/forgot-password`, { method: "POST", body: JSON.stringify({ email }) });
}

export function companyResetPassword(slug: string, token: string, newPassword: string): Promise<{ ok: boolean }> {
  return request(`/company/${slug}/auth/reset-password`, { method: "POST", body: JSON.stringify({ token, newPassword }) });
}

export interface CompanyDashboardData {
  company: {
    name: string;
    accentColor: string;
    secondaryColor: string | null;
    cardTemplate: "BANNER" | "GRADIENT" | "FRAME" | "SPLIT";
    logoUrl: string | null;
    joinToken: string;
    pointsPerCurrencyUnit: string;
  };
  stats: {
    customersCount: number;
    transactionsCount: number;
    transactionsToday: number;
    newCustomersToday: number;
    pointsDistributed: number;
    totalAmount: string;
    recentTransactions: Array<{
      id: string;
      type: string;
      amount: string;
      pointsDelta: number;
      balanceAfter: number;
      createdAt: string;
      customerName: string;
    }>;
  };
}

export function getCompanyDashboard(slug: string): Promise<CompanyDashboardData> {
  return request(`/company/${slug}/dashboard`);
}

export function qrCodeUrl(joinToken: string): string {
  return `${API_BASE_URL}/join/${encodeURIComponent(joinToken)}/qrcode.png`;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  active: boolean;
  createdAt: string;
}

export function listEmployees(slug: string): Promise<{ employees: Employee[] }> {
  return request(`/company/${slug}/employees`);
}

export interface CreateEmployeeResult {
  name: string;
  email: string;
  role: string;
  temporaryPassword: string;
}

export function createEmployee(
  slug: string,
  input: { name: string; email: string; role: string },
): Promise<CreateEmployeeResult> {
  return request(`/company/${slug}/employees`, { method: "POST", body: JSON.stringify(input) });
}

export function updateEmployee(
  slug: string,
  employeeId: string,
  patch: { role?: string; active?: boolean },
): Promise<Employee> {
  return request(`/company/${slug}/employees/${employeeId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export interface Customer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  purchaseCount: number;
  lastPurchaseAt: string | null;
  loyaltyNumber: string;
  pointsBalance: number;
  status: string;
  hasActiveCard: boolean;
  createdAt: string;
}

export function listCustomers(slug: string, search?: string): Promise<{ customers: Customer[] }> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return request(`/company/${slug}/customers${query}`);
}

export function revokeCustomerCard(slug: string, customerId: string): Promise<{ revoked: boolean }> {
  return request(`/company/${slug}/customers/${customerId}/revoke-token`, { method: "POST" });
}

export interface BirthdayCustomer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  loyaltyNumber: string;
  email: string | null;
}

export function getTodaysBirthdays(slug: string): Promise<{ customers: BirthdayCustomer[] }> {
  return request(`/company/${slug}/customers/birthdays-today`);
}

export interface CustomerTransaction {
  id: string;
  type: string;
  status: string;
  amount: string;
  pointsDelta: number;
  balanceAfter: number;
  createdAt: string;
}

export interface CustomerDetail {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  loyaltyNumber: string;
  pointsBalance: number;
  lifetimePoints: number;
  status: string;
  hasActiveCard: boolean;
  createdAt: string;
  companyName: string;
  companyLogoUrl: string | null;
  companyAccentColor: string;
  companySecondaryColor: string | null;
  companyCardTemplate: "BANNER" | "GRADIENT" | "FRAME" | "SPLIT";
  programType: "POINTS" | "DISCOUNT";
  availableRewards: AvailableReward[];
  currentDiscountPercent: string | null;
  offPeakBonus: { enabled: boolean; startHour: number; endHour: number };
  recentTransactions: CustomerTransaction[];
}

export function getCustomerDetail(slug: string, customerId: string): Promise<CustomerDetail> {
  return request(`/company/${slug}/customers/${customerId}`);
}

export function redeemCustomerReward(
  slug: string,
  customerId: string,
  rewardId: string,
): Promise<TransactionResult> {
  return request(`/company/${slug}/customers/${customerId}/redeem`, {
    method: "POST",
    body: JSON.stringify({ rewardId }),
  });
}

export function customerBarcodeUrl(slug: string, customerId: string): string {
  return `${API_BASE_URL}/company/${slug}/customers/${customerId}/barcode.png`;
}

export interface NotifyResult {
  customerId: string;
  ok: boolean;
  reason?: "NO_EMAIL" | "SEND_FAILED";
}

export function sendCustomerNotifications(
  slug: string,
  input: { customerIds: string[]; subject: string; message: string },
): Promise<{ results: NotifyResult[] }> {
  return request(`/company/${slug}/customers/notify`, { method: "POST", body: JSON.stringify(input) });
}

export interface Reward {
  id: string;
  name: string;
  pointsCost: number;
  active: boolean;
}

export interface DiscountTier {
  id: string;
  label: string;
  thresholdPoints: number;
  discountPercent: string;
}

export interface InactivityReminderConfig {
  enabled: boolean;
  thresholdDays: number;
  subject: string;
  message: string;
}

export interface OffPeakBonusConfig {
  enabled: boolean;
  startHour: number;
  endHour: number;
}

export interface PointsExpiryConfig {
  enabled: boolean;
  days: number;
}

export interface ProgramData {
  programType: "POINTS" | "DISCOUNT";
  rewards: Reward[];
  discountTiers: DiscountTier[];
  inactivityReminder: InactivityReminderConfig;
  referralBonusPoints: number;
  offPeakBonus: OffPeakBonusConfig;
  pointsExpiry: PointsExpiryConfig;
}

export function updateReferralBonus(slug: string, bonusPoints: number): Promise<{ bonusPoints: number }> {
  return request(`/company/${slug}/program/referral`, { method: "PATCH", body: JSON.stringify({ bonusPoints }) });
}

export function updateOffPeakBonus(slug: string, input: OffPeakBonusConfig): Promise<OffPeakBonusConfig> {
  return request(`/company/${slug}/program/off-peak`, { method: "PATCH", body: JSON.stringify(input) });
}

export function updatePointsExpiry(slug: string, input: PointsExpiryConfig): Promise<PointsExpiryConfig> {
  return request(`/company/${slug}/program/points-expiry`, { method: "PATCH", body: JSON.stringify(input) });
}

export interface RunExpiryResult {
  companyId: string;
  companyName: string;
  expiredCount: number;
  totalPointsExpired: number;
}

export function runPointsExpiryNow(slug: string): Promise<RunExpiryResult> {
  return request(`/company/${slug}/program/points-expiry/run-now`, { method: "POST" });
}

export function updateInactivityReminder(
  slug: string,
  input: InactivityReminderConfig,
): Promise<InactivityReminderConfig> {
  return request(`/company/${slug}/program/inactivity-reminder`, { method: "PATCH", body: JSON.stringify(input) });
}

export interface RunReminderResult {
  companyId: string;
  companyName: string;
  sent: number;
  failed: number;
}

export function runInactivityReminderNow(slug: string): Promise<RunReminderResult> {
  return request(`/company/${slug}/program/inactivity-reminder/run-now`, { method: "POST" });
}

export function getProgram(slug: string): Promise<ProgramData> {
  return request(`/company/${slug}/program`);
}

export function updateProgramType(slug: string, programType: "POINTS" | "DISCOUNT"): Promise<{ programType: string }> {
  return request(`/company/${slug}/program`, { method: "PATCH", body: JSON.stringify({ programType }) });
}

export function createReward(slug: string, input: { name: string; pointsCost: number }): Promise<Reward> {
  return request(`/company/${slug}/program/rewards`, { method: "POST", body: JSON.stringify(input) });
}

export function updateReward(
  slug: string,
  rewardId: string,
  patch: { name?: string; pointsCost?: number; active?: boolean },
): Promise<Reward> {
  return request(`/company/${slug}/program/rewards/${rewardId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteReward(slug: string, rewardId: string): Promise<void> {
  await request(`/company/${slug}/program/rewards/${rewardId}`, { method: "DELETE" });
}

export function createDiscountTier(
  slug: string,
  input: { label: string; thresholdPoints: number; discountPercent: string },
): Promise<DiscountTier> {
  return request(`/company/${slug}/program/discount-tiers`, { method: "POST", body: JSON.stringify(input) });
}

export function updateDiscountTier(
  slug: string,
  tierId: string,
  patch: { label?: string; thresholdPoints?: number; discountPercent?: string },
): Promise<DiscountTier> {
  return request(`/company/${slug}/program/discount-tiers/${tierId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteDiscountTier(slug: string, tierId: string): Promise<void> {
  await request(`/company/${slug}/program/discount-tiers/${tierId}`, { method: "DELETE" });
}

export type EmailConfigStatus =
  | { configured: false; usingPlatformDefault: boolean }
  | { configured: true; fromAddress: string; hasOwnApiKey: boolean };

export function getEmailConfig(slug: string): Promise<EmailConfigStatus> {
  return request(`/company/${slug}/email-config`);
}

export interface EmailConfigInput {
  fromAddress: string;
  /** Optionnelle : sans clé propre, l'envoi utilise le compte Resend partagé de la plateforme. */
  smtpPassword?: string;
}

export function saveEmailConfig(slug: string, input: EmailConfigInput): Promise<{ configured: boolean }> {
  return request(`/company/${slug}/email-config`, { method: "PUT", body: JSON.stringify(input) });
}

export async function removeEmailConfig(slug: string): Promise<void> {
  await request(`/company/${slug}/email-config`, { method: "DELETE" });
}

// --- Scan en caisse ---

export interface AvailableReward {
  id: string;
  name: string;
  pointsCost: number;
}

export interface ScanResolveResult {
  customerId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  loyaltyNumber: string;
  pointsBalance: number;
  lifetimePoints: number;
  createdAt: string;
  programType: "POINTS" | "DISCOUNT";
  programName: string;
  companyName: string;
  companyLogoUrl: string | null;
  companyAccentColor: string;
  availableRewards: AvailableReward[];
  currentDiscountPercent: string | null;
  offPeakActive: boolean;
}

export function resolveScan(slug: string, token: string): Promise<ScanResolveResult> {
  return request(`/company/${slug}/scan/resolve`, { method: "POST", body: JSON.stringify({ token }) });
}

export interface TransactionResult {
  transactionId: string;
  status: string;
  pointsDelta: number;
  balanceAfter: number;
}

export function recordScanPurchase(slug: string, customerId: string, amount: string): Promise<TransactionResult> {
  return request(`/company/${slug}/scan/transactions`, {
    method: "POST",
    body: JSON.stringify({ customerId, amount, idempotencyKey: crypto.randomUUID() }),
  });
}

export function redeemScanReward(slug: string, customerId: string, rewardId: string): Promise<TransactionResult> {
  return request(`/company/${slug}/scan/transactions/redeem`, {
    method: "POST",
    body: JSON.stringify({ customerId, rewardId, idempotencyKey: crypto.randomUUID() }),
  });
}

export interface TerminalKey {
  id: string;
  label: string;
  active: boolean;
  createdAt: string;
}

export function listTerminals(slug: string): Promise<{ terminals: TerminalKey[] }> {
  return request(`/company/${slug}/terminals`);
}

export function createTerminalKey(slug: string, label: string): Promise<{ id: string; label: string; apiKey: string }> {
  return request(`/company/${slug}/terminals`, { method: "POST", body: JSON.stringify({ label }) });
}

export function setTerminalActive(slug: string, id: string, active: boolean): Promise<TerminalKey> {
  return request(`/company/${slug}/terminals/${id}`, { method: "PATCH", body: JSON.stringify({ active }) });
}

export type PosApiStatus =
  | { configured: false }
  | { configured: true; providerName: string; apiBaseUrl: string | null; connectedAt: string | null; updatedAt: string };

export function getPosApiCredential(slug: string): Promise<PosApiStatus> {
  return request(`/company/${slug}/pos-api`);
}

export function savePosApiCredential(
  slug: string,
  input: { providerName: string; apiKey: string; apiBaseUrl?: string },
): Promise<{ configured: true }> {
  return request(`/company/${slug}/pos-api`, { method: "PUT", body: JSON.stringify(input) });
}

export function removePosApiCredential(slug: string): Promise<void> {
  return request(`/company/${slug}/pos-api`, { method: "DELETE" });
}
