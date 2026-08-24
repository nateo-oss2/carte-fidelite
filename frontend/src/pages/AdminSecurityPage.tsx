import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  adminMe,
  adminMfaDisable,
  adminMfaSetup,
  adminMfaVerifySetup,
  listBackups,
  listSecurityAlerts,
  resolveSecurityAlert,
  runBackupNow,
  ApiError,
  type BackupEntry,
  type SecurityAlert,
} from "../lib/adminApi";

export function AdminSecurityPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  useEffect(() => {
    adminMe()
      .then((me) => setMfaEnabled(me.mfaEnabled))
      .catch(() => navigate("/admin/login"))
      .finally(() => setChecking(false));
  }, [navigate]);

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-black/40">Chargement…</div>;
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <Link to="/admin" className="text-xs text-black/40 hover:text-black/70">
        ← Retour aux entreprises
      </Link>

      <h1 className="text-lg font-bold uppercase tracking-widest mt-4 mb-8" style={{ fontFamily: "var(--font-display)" }}>
        Sécurité
      </h1>

      <div className="mb-10">
        <MfaSection enabled={mfaEnabled} onChanged={setMfaEnabled} />
      </div>

      <div className="mb-10">
        <AlertsSection />
      </div>

      <div>
        <BackupsSection />
      </div>
    </div>
  );
}

function MfaSection({ enabled, onChanged }: { enabled: boolean; onChanged: (v: boolean) => void }) {
  const [setupState, setSetupState] = useState<{ qrCodeDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleStartSetup() {
    setError(null);
    const result = await adminMfaSetup();
    setSetupState(result);
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminMfaVerifySetup(code.trim());
      setSetupState(null);
      setCode("");
      onChanged(true);
    } catch {
      setError("Code incorrect.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminMfaDisable(code.trim());
      setCode("");
      onChanged(false);
    } catch {
      setError("Code incorrect.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-black/45 mb-3">
        Double authentification (MFA)
      </p>

      {enabled ? (
        <form onSubmit={handleDisable} className="rounded-2xl border border-black/10 bg-white p-4 flex flex-col gap-3">
          <p className="text-sm text-black/70">Activée. Entrez un code pour la désactiver.</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="Code à 6 chiffres"
            className="w-40 rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="self-start rounded-xl py-2.5 px-5 text-sm font-bold uppercase tracking-wider text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-60"
          >
            Désactiver
          </button>
        </form>
      ) : setupState ? (
        <form onSubmit={handleVerify} className="rounded-2xl border border-black/10 bg-white p-4 flex flex-col gap-3">
          <p className="text-sm text-black/70">
            Scannez ce QR code avec Google Authenticator, Authy ou une app équivalente, puis entrez le code généré.
          </p>
          <img src={setupState.qrCodeDataUrl} alt="QR code MFA" className="w-40 h-40 self-center" />
          <p className="text-xs text-black/40 text-center font-mono break-all">{setupState.secret}</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="Code à 6 chiffres"
            className="w-40 rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30 self-center text-center"
            autoFocus
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl py-2.5 px-5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
            style={{ background: "#171512" }}
          >
            Confirmer et activer
          </button>
        </form>
      ) : (
        <div className="rounded-2xl border border-black/10 bg-white p-4 flex flex-col gap-3">
          <p className="text-sm text-black/70">
            Non activée. Recommandé pour protéger votre compte administrateur.
          </p>
          <button
            type="button"
            onClick={handleStartSetup}
            className="self-start rounded-xl py-2.5 px-5 text-sm font-bold uppercase tracking-wider text-white"
            style={{ background: "#171512" }}
          >
            Activer
          </button>
        </div>
      )}
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  RAPID_SCAN_FAILURES: "Rafale de scans invalides",
  RAPID_TRANSACTIONS: "Rafale de transactions",
  UNUSUAL_AMOUNT: "Montant inhabituel",
  REVOKED_TOKEN_ATTEMPT: "Token révoqué utilisé",
  EXCESSIVE_LOGIN_FAILURES: "Échecs de connexion répétés",
};

function AlertsSection() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    listSecurityAlerts("false")
      .then((res) => setAlerts(res.alerts))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleResolve(id: string) {
    await resolveSecurityAlert(id);
    refresh();
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-black/45 mb-3">
        Alertes anti-fraude non résolues
      </p>
      {loading ? (
        <p className="text-sm text-black/40">Chargement…</p>
      ) : alerts.length === 0 ? (
        <p className="text-sm text-black/40">Aucune alerte active.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <li key={alert.id} className="rounded-2xl border border-black/10 bg-white p-4 flex items-center gap-4">
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg flex-shrink-0 ${
                  alert.severity === "HIGH"
                    ? "bg-red-100 text-red-700"
                    : alert.severity === "MEDIUM"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-black/5 text-black/50"
                }`}
              >
                {alert.severity}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{TYPE_LABELS[alert.type] ?? alert.type}</p>
                <p className="text-xs text-black/50">{alert.message}</p>
                <p className="text-xs text-black/40 mt-0.5">
                  {alert.companyName ?? "—"} · {new Date(alert.createdAt).toLocaleString("fr-FR")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleResolve(alert.id)}
                className="text-xs font-semibold text-black/50 hover:text-black flex-shrink-0"
              >
                Résoudre
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BackupsSection() {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    listBackups()
      .then((res) => setBackups(res.backups))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleRunNow() {
    setRunning(true);
    setError(null);
    try {
      await runBackupNow();
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? "La sauvegarde a échoué." : "Une erreur est survenue.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-black/45">Sauvegardes de la base</p>
        <button
          type="button"
          onClick={handleRunNow}
          disabled={running}
          className="text-xs font-semibold text-black/50 hover:text-black disabled:opacity-50"
        >
          {running ? "En cours…" : "Sauvegarder maintenant"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {loading ? (
        <p className="text-sm text-black/40">Chargement…</p>
      ) : backups.length === 0 ? (
        <p className="text-sm text-black/40">Aucune sauvegarde pour le moment.</p>
      ) : (
        <ul className="rounded-2xl border border-black/10 bg-white overflow-hidden">
          {backups.map((backup) => (
            <li key={backup.file} className="px-4 py-3 border-t border-black/5 first:border-t-0 flex items-center justify-between">
              <span className="text-sm font-mono text-black/70">{backup.file}</span>
              <span className="text-xs text-black/40">
                {(backup.sizeBytes / 1024).toFixed(0)} Ko · {new Date(backup.createdAt).toLocaleString("fr-FR")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
