import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { companyMe } from "../lib/companyApi";
import {
  recordPurchase,
  redeemReward,
  resolveScan,
  ScanApiError,
  type ScanResolveResult,
  type TransactionResult,
} from "../lib/scanApi";

function terminalKeyStorageKey(slug: string) {
  return `terminal_key_${slug}`;
}

export function ScanPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [terminalKey, setTerminalKey] = useState<string | null>(() =>
    typeof window !== "undefined" ? window.localStorage.getItem(terminalKeyStorageKey(slug)) : null,
  );

  useEffect(() => {
    companyMe(slug)
      .then((me) => {
        setRole(me.role);
        setEmployeeId(me.id);
      })
      .catch(() => navigate(`/company/${slug}/login`))
      .finally(() => setChecking(false));
  }, [slug, navigate]);

  function handleActivated(key: string) {
    window.localStorage.setItem(terminalKeyStorageKey(slug), key);
    setTerminalKey(key);
  }

  function handleInvalidKey() {
    window.localStorage.removeItem(terminalKeyStorageKey(slug));
    setTerminalKey(null);
  }

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-black/40">Chargement…</div>;
  }

  if (!terminalKey) {
    return <TerminalSetup slug={slug} role={role} onActivated={handleActivated} />;
  }

  return (
    <ScanConsole slug={slug} terminalKey={terminalKey} employeeId={employeeId} onInvalidKey={handleInvalidKey} />
  );
}

function TerminalSetup({
  slug,
  role,
  onActivated,
}: {
  slug: string;
  role: string | null;
  onActivated: (key: string) => void;
}) {
  const [pastedKey, setPastedKey] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleQuickActivate() {
    setCreating(true);
    setError(null);
    try {
      const { createTerminal } = await import("../lib/companyApi");
      const res = await createTerminal(slug, `Poste — ${new Date().toLocaleDateString("fr-FR")}`);
      onActivated(res.apiKey);
    } catch {
      setError("Une erreur est survenue.");
    } finally {
      setCreating(false);
    }
  }

  function handlePasteSubmit(e: FormEvent) {
    e.preventDefault();
    if (pastedKey.trim()) onActivated(pastedKey.trim());
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-md mx-auto flex flex-col justify-center">
      <Link to={`/company/${slug}`} className="text-xs text-black/40 hover:text-black/70 mb-6 self-start">
        ← Retour au dashboard
      </Link>

      <h1 className="text-lg font-bold uppercase tracking-widest mb-1" style={{ fontFamily: "var(--font-display)" }}>
        Configurer ce poste
      </h1>
      <p className="text-xs text-black/40 mb-6">
        Cet appareil n'a pas encore de clé de terminal enregistrée. C'est nécessaire une seule fois par appareil.
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {role === "ADMIN" && (
        <div className="rounded-2xl border border-black/10 bg-white p-5 mb-5 flex flex-col gap-3">
          <p className="text-sm text-black/70">Activer directement ce poste comme nouveau terminal.</p>
          <button
            type="button"
            onClick={handleQuickActivate}
            disabled={creating}
            className="rounded-xl py-3 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
            style={{ background: "#171512" }}
          >
            {creating ? "Activation…" : "Activer ce poste"}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-black/10 bg-white p-5">
        <p className="text-sm text-black/70 mb-3">
          {role === "ADMIN"
            ? "Ou collez la clé d'un terminal déjà créé (page Terminaux) :"
            : "Demandez à un administrateur de vous transmettre une clé de terminal (page Terminaux du dashboard), puis collez-la ici :"}
        </p>
        <form onSubmit={handlePasteSubmit} className="flex flex-col gap-3">
          <input
            value={pastedKey}
            onChange={(e) => setPastedKey(e.target.value)}
            placeholder="Clé du terminal"
            className="rounded-xl border border-black/10 px-4 py-3 text-sm font-mono outline-none focus:border-black/30"
          />
          <button
            type="submit"
            className="rounded-xl py-3 text-sm font-bold uppercase tracking-wider text-black/70 border border-black/10 hover:border-black/30"
          >
            Enregistrer sur cet appareil
          </button>
        </form>
        {role === "ADMIN" && (
          <Link to={`/company/${slug}/terminals`} className="text-xs text-black/40 hover:text-black/70 mt-3 inline-block">
            Gérer les terminaux →
          </Link>
        )}
      </div>
    </div>
  );
}

type ConsoleState =
  | { mode: "scanning" }
  | { mode: "loading" }
  | { mode: "error"; message: string }
  | { mode: "result"; data: ScanResolveResult };

function ScanConsole({
  slug,
  terminalKey,
  employeeId,
  onInvalidKey,
}: {
  slug: string;
  terminalKey: string;
  employeeId: string | null;
  onInvalidKey: () => void;
}) {
  const [state, setState] = useState<ConsoleState>({ mode: "scanning" });
  const [scanValue, setScanValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.mode === "scanning") inputRef.current?.focus();
  }, [state.mode]);

  async function handleScanSubmit(e: FormEvent) {
    e.preventDefault();
    const token = scanValue.trim();
    setScanValue("");
    if (!token) return;

    setState({ mode: "loading" });
    try {
      const data = await resolveScan(terminalKey, token);
      setState({ mode: "result", data });
    } catch (err) {
      if (err instanceof ScanApiError && (err.code === "TERMINAL_KEY_MISSING" || err.code === "TERMINAL_KEY_INVALID")) {
        onInvalidKey();
        return;
      }
      setState({
        mode: "error",
        message:
          err instanceof ScanApiError && err.code === "CUSTOMER_NOT_FOUND"
            ? "Carte inconnue ou n'appartenant pas à cette entreprise."
            : "Impossible de lire cette carte. Réessayez.",
      });
    }
  }

  function resetToScan() {
    setState({ mode: "scanning" });
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link to={`/company/${slug}`} className="text-xs text-black/40 hover:text-black/70">
            ← Retour au dashboard
          </Link>
          <span className="text-xs text-black/30">Poste actif</span>
        </div>

        {(state.mode === "scanning" || state.mode === "loading" || state.mode === "error") && (
          <form onSubmit={handleScanSubmit} className="rounded-2xl border border-black/10 bg-white p-8 flex flex-col items-center gap-5">
            <div className="w-14 h-14 rounded-full border-2 border-black/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3M7 12h10"
                  stroke="#171512"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="text-sm text-black/60 text-center">Scannez la carte du client</p>
            <input
              ref={inputRef}
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              autoFocus
              autoComplete="off"
              placeholder="En attente du scan…"
              disabled={state.mode === "loading"}
              className="w-full text-center rounded-xl border border-black/10 px-4 py-3 text-sm font-mono outline-none focus:border-black/30 disabled:opacity-50"
            />
            {state.mode === "error" && <p className="text-sm text-red-600 text-center">{state.message}</p>}
          </form>
        )}

        {state.mode === "result" && (
          <ResultCard
            data={state.data}
            terminalKey={terminalKey}
            employeeId={employeeId}
            onDone={resetToScan}
          />
        )}
      </div>
    </div>
  );
}

function ResultCard({
  data,
  terminalKey,
  employeeId,
  onDone,
}: {
  data: ScanResolveResult;
  terminalKey: string;
  employeeId: string | null;
  onDone: () => void;
}) {
  const [current, setCurrent] = useState(data);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<TransactionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const displayName = [current.firstName, current.lastName].filter(Boolean).join(" ") || current.loyaltyNumber;
  const initials = [current.firstName?.[0], current.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";
  const memberSince = new Date(current.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  async function handlePurchase(e: FormEvent) {
    e.preventDefault();
    if (!amount.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await recordPurchase(terminalKey, {
        customerId: current.customerId,
        amount: amount.trim(),
        employeeId: employeeId ?? undefined,
      });
      setLastResult(result);
      setCurrent({ ...current, pointsBalance: result.balanceAfter });
      setAmount("");
    } catch {
      setError("Impossible d'enregistrer cet achat.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRedeem(rewardId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await redeemReward(terminalKey, {
        customerId: current.customerId,
        rewardId,
        employeeId: employeeId ?? undefined,
      });
      setLastResult(result);
      setCurrent({
        ...current,
        pointsBalance: result.balanceAfter,
        availableRewards: current.availableRewards.filter((r) => r.pointsCost <= result.balanceAfter),
      });
    } catch {
      setError("Impossible d'échanger cette récompense.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-black/10 bg-white px-5 py-4 flex items-center gap-3">
        {current.companyLogoUrl && (
          <img src={current.companyLogoUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
        )}
        <span className="text-xs font-semibold uppercase tracking-widest text-black/60">{current.companyName}</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-green-700">
          <span className="w-1.5 h-1.5 rounded-full bg-green-600" /> Carte scannée
        </span>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-base font-bold text-white flex-shrink-0"
            style={{ fontFamily: "var(--font-display)", background: "linear-gradient(150deg, #171512, #3a352c)" }}
          >
            {initials}
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {displayName}
            </p>
            <p className="text-xs text-black/40 mt-0.5">Client·e depuis le {memberSince}</p>
          </div>
        </div>

        <div className="rounded-xl bg-black/[0.03] border border-black/5 px-4 py-3 flex items-center justify-between mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-black/40">Numéro de fidélité</p>
          <p className="text-sm font-mono tracking-wider text-black/85">{current.loyaltyNumber}</p>
        </div>

        {current.programType === "POINTS" ? (
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-4xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {current.pointsBalance}
            </span>
            <span className="text-xs text-black/45">points disponibles</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-4xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {current.currentDiscountPercent ? `${Number(current.currentDiscountPercent)}%` : "—"}
            </span>
            <span className="text-xs text-black/45">de réduction actuelle</span>
          </div>
        )}
        <p className="text-xs text-black/35 font-mono">{current.lifetimePoints} pts cumulés au total</p>
      </div>

      {lastResult && (
        <div className="rounded-2xl border border-green-600/20 bg-green-50 px-5 py-4">
          <p className="text-sm font-semibold text-green-800">
            {lastResult.pointsDelta >= 0 ? `+${lastResult.pointsDelta} pts enregistrés` : `${lastResult.pointsDelta} pts — récompense échangée`}
          </p>
          <p className="text-xs text-green-700/70 mt-0.5">Nouveau solde : {lastResult.balanceAfter} pts</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600 px-1">{error}</p>}

      <div className="rounded-2xl border border-black/10 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-black/40 mb-3">Enregistrer un achat</p>
        <form onSubmit={handlePurchase} className="flex gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Montant en €"
            inputMode="decimal"
            className="flex-1 rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/30"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl px-5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
            style={{ background: "#171512" }}
          >
            Encaisser
          </button>
        </form>
      </div>

      {current.programType === "POINTS" && current.availableRewards.length > 0 && (
        <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
          <p className="text-xs font-semibold uppercase tracking-widest text-black/40 px-5 pt-4 pb-2">
            Récompenses disponibles
          </p>
          <ul>
            {current.availableRewards.map((reward) => (
              <li key={reward.id} className="px-5 py-3 border-t border-black/5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{reward.name}</p>
                  <p className="text-xs text-black/40 font-mono">{reward.pointsCost} pts</p>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleRedeem(reward.id)}
                  className="text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-lg text-black/70 border border-black/10 hover:border-black/30 disabled:opacity-50"
                >
                  Échanger
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onDone}
        className="rounded-xl py-3 text-sm font-bold uppercase tracking-wider text-black/70 border border-black/10 hover:border-black/30"
      >
        Client suivant
      </button>
    </div>
  );
}
