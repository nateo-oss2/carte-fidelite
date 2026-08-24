import { getAccessToken } from "./auth";
import { HttpError } from "../../lib/httpError";

const BASE_URL = "https://walletobjects.googleapis.com/walletobjects/v1";

async function call(method: string, path: string, body?: unknown): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Crée une classe ou un objet Google Wallet s'il n'existe pas déjà (idempotent : l'API Google
 * renvoie 409 si l'id existe déjà, auquel cas on bascule sur une mise à jour).
 */
export async function upsertWalletResource(resourcePath: string, id: string, payload: unknown): Promise<void> {
  const insertRes = await call("POST", resourcePath, payload);
  if (insertRes.ok) {
    return;
  }

  if (insertRes.status === 409) {
    const patchRes = await call("PATCH", `${resourcePath}/${id}`, payload);
    if (!patchRes.ok) {
      const text = await patchRes.text();
      throw new HttpError(502, "GOOGLE_WALLET_API_ERROR", text);
    }
    return;
  }

  const text = await insertRes.text();
  throw new HttpError(502, "GOOGLE_WALLET_API_ERROR", text);
}
