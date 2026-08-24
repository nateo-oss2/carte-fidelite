const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

// Ces routes sont authentifiées par la clé du terminal (poste de caisse), pas par la session
// employé — un simple scan ne doit jamais suffire à créer une transaction (voir scan.ts côté
// serveur). La clé est stockée localement sur cet appareil, jamais envoyée ailleurs.

export class ScanApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

async function terminalRequest<T>(path: string, terminalKey: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Terminal-Key": terminalKey, ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "UNKNOWN_ERROR" }));
    throw new ScanApiError(res.status, body.error ?? "UNKNOWN_ERROR");
  }

  return res.json() as Promise<T>;
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

export function resolveScan(terminalKey: string, token: string): Promise<ScanResolveResult> {
  return terminalRequest("/scan/resolve", terminalKey, { method: "POST", body: JSON.stringify({ token }) });
}

export interface TransactionResult {
  transactionId: string;
  status: string;
  pointsDelta: number;
  balanceAfter: number;
}

export function recordPurchase(
  terminalKey: string,
  input: { customerId: string; amount: string; employeeId?: string },
): Promise<TransactionResult> {
  return terminalRequest("/transactions", terminalKey, {
    method: "POST",
    body: JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() }),
  });
}

export function redeemReward(
  terminalKey: string,
  input: { customerId: string; rewardId: string; employeeId?: string },
): Promise<TransactionResult> {
  return terminalRequest("/transactions/redeem", terminalKey, {
    method: "POST",
    body: JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() }),
  });
}
