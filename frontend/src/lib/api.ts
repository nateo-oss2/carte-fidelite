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
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "UNKNOWN_ERROR" }));
    throw new ApiError(res.status, body.error ?? "UNKNOWN_ERROR");
  }

  return res.json() as Promise<T>;
}

export interface CompanyPublicInfo {
  companyName: string;
  logoUrl: string | null;
  programName: string;
  accentColor: string;
  pointsPerCurrencyUnit: string;
}

export function fetchCompanyByJoinToken(companyToken: string): Promise<CompanyPublicInfo> {
  return request(`/join/${encodeURIComponent(companyToken)}`);
}

export interface JoinPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface JoinResponse {
  customerId: string;
  loyaltyNumber: string;
  pointsBalance: number;
  alreadyEnrolled: boolean;
  walletToken: string;
}

export function joinCompanyProgram(companyToken: string, payload: JoinPayload): Promise<JoinResponse> {
  return request(`/join/${encodeURIComponent(companyToken)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function applePassDownloadUrl(walletToken: string): string {
  return `${API_BASE_URL}/wallet/apple/pass?token=${encodeURIComponent(walletToken)}`;
}

export function googleWalletSaveUrl(walletToken: string): string {
  return `${API_BASE_URL}/wallet/google/save-link?token=${encodeURIComponent(walletToken)}`;
}
