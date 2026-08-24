import { GoogleAuth } from "google-auth-library";
import { getServiceAccountEmail, getServiceAccountPrivateKey } from "./config";

let cachedAuth: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (!cachedAuth) {
    cachedAuth = new GoogleAuth({
      credentials: {
        client_email: getServiceAccountEmail(),
        private_key: getServiceAccountPrivateKey(),
      },
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });
  }
  return cachedAuth;
}

/** Jeton OAuth2 du compte de service, pour appeler l'API REST Google Wallet Objects. */
export async function getAccessToken(): Promise<string> {
  const client = await getAuth().getClient();
  const { token } = await client.getAccessToken();
  if (!token) {
    throw new Error("GOOGLE_WALLET_ACCESS_TOKEN_UNAVAILABLE");
  }
  return token;
}
