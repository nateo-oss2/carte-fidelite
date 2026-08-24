const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

// Page de scan autonome : pas de session, pas de cookie — la confidentialité du scanToken
// dans l'URL fait office de protection (voir scanConsole.ts côté serveur).

export class ScanConsoleError extends Error {
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
    throw new ScanConsoleError(res.status, body.error ?? "UNKNOWN_ERROR");
  }

  return res.json() as Promise<T>;
}

export interface ScanConsoleInfo {
  companyName: string;
  companyLogoUrl: string | null;
  companyAccentColor: string;
}

export function getScanConsoleInfo(scanToken: string): Promise<ScanConsoleInfo> {
  return request(`/scan-console/${scanToken}`);
}

export interface AvailableReward {
  id: string;
  name: string;
  pointsCost: number;
}

export interface ScanResolveResult {
  customerId: string;
  firstName: string | null;
  lastName: string | null;
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
}

export function resolveScan(scanToken: string, token: string): Promise<ScanResolveResult> {
  return request(`/scan-console/${scanToken}/resolve`, { method: "POST", body: JSON.stringify({ token }) });
}

export interface TransactionResult {
  transactionId: string;
  status: string;
  pointsDelta: number;
  balanceAfter: number;
}

export function recordScanPurchase(
  scanToken: string,
  customerId: string,
  amount: string,
): Promise<TransactionResult> {
  return request(`/scan-console/${scanToken}/transactions`, {
    method: "POST",
    body: JSON.stringify({ customerId, amount, idempotencyKey: crypto.randomUUID() }),
  });
}

export function redeemScanReward(
  scanToken: string,
  customerId: string,
  rewardId: string,
): Promise<TransactionResult> {
  return request(`/scan-console/${scanToken}/transactions/redeem`, {
    method: "POST",
    body: JSON.stringify({ customerId, rewardId, idempotencyKey: crypto.randomUUID() }),
  });
}
