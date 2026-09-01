import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  companyMe,
  createDiscountTier,
  createReward,
  createTerminalKey,
  deleteDiscountTier,
  deleteReward,
  getEmailConfig,
  getPosApiCredential,
  getProgram,
  listTerminals,
  removeEmailConfig,
  removePosApiCredential,
  runInactivityReminderNow,
  runPointsExpiryNow,
  saveEmailConfig,
  savePosApiCredential,
  setTerminalActive,
  updateInactivityReminder,
  updateOffPeakBonus,
  updatePointsExpiry,
  updateProgramType,
  updateReferralBonus,
  updateReward,
  ApiError,
  type DiscountTier,
  type EmailConfigStatus,
  type InactivityReminderConfig,
  type OffPeakBonusConfig,
  type PointsExpiryConfig,
  type PosApiStatus,
  type ProgramData,
  type Reward,
  type TerminalKey,
} from "../lib/companyApi";

export function CompanyProgramPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [program, setProgram] = useState<ProgramData | null>(null);
  const [switching, setSwitching] = useState(false);

  const refresh = useCallback(() => {
    getProgram(slug).then(setProgram);
  }, [slug]);

  useEffect(() => {
    companyMe(slug)
      .then((me) => setRole(me.role))
      .catch(() => navigate(`/company/${slug}/login`))
      .finally(() => setChecking(false));
  }, [slug, navigate]);

  useEffect(() => {
    if (!checking) refresh();
  }, [checking, refresh]);

  async function handleSwitch(type: "POINTS" | "DISCOUNT") {
    setSwitching(true);
    try {
      await updateProgramType(slug, type);
      refresh();
    } finally {
      setSwitching(false);
    }
  }

  if (checking || !program) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-black/40">Chargement…</div>;
  }

  const isAdmin = role === "ADMIN";

  return (
    <div className="min-h-screen px-6 py-10 max-w-md mx-auto">
      <Link to={`/company/${slug}`} className="text-xs text-black/40 hover:text-black/70">
        ← Retour au dashboard
      </Link>

      <h1 className="text-lg font-bold uppercase tracking-widest mt-4 mb-6" style={{ fontFamily: "var(--font-display)" }}>
        Programme de fidélité
      </h1>

      {isAdmin ? (
        <div className="flex gap-3 mb-8">
          <button
            type="button"
            onClick={() => handleSwitch("POINTS")}
            disabled={switching}
            className={`flex-1 rounded-2xl border p-4 text-left transition-colors ${
              program.programType === "POINTS" ? "border-black bg-black/[0.03]" : "border-black/10"
            }`}
          >
            <p className="text-sm font-semibold">Points</p>
            <p className="text-xs text-black/50 mt-1">Les clients échangent leurs points contre des récompenses</p>
          </button>
          <button
            type="button"
            onClick={() => handleSwitch("DISCOUNT")}
            disabled={switching}
            className={`flex-1 rounded-2xl border p-4 text-left transition-colors ${
              program.programType === "DISCOUNT" ? "border-black bg-black/[0.03]" : "border-black/10"
            }`}
          >
            <p className="text-sm font-semibold">Réduction</p>
            <p className="text-xs text-black/50 mt-1">Une réduction automatique selon des paliers de fidélité</p>
          </button>
        </div>
      ) : (
        <p className="text-sm text-black/50 mb-8">
          Mode actuel : <strong>{program.programType === "POINTS" ? "Points" : "Réduction"}</strong>. Seul un
          administrateur peut le modifier.
        </p>
      )}

      {program.programType === "POINTS" ? (
        <RewardsSection slug={slug} rewards={program.rewards} isAdmin={isAdmin} onChanged={refresh} />
      ) : (
        <TiersSection slug={slug} tiers={program.discountTiers} isAdmin={isAdmin} onChanged={refresh} />
      )}

      {isAdmin && (
        <div className="mt-10 pt-8 border-t border-black/10">
          <EmailConfigSection slug={slug} />
        </div>
      )}

      {isAdmin && (
        <div className="mt-10 pt-8 border-t border-black/10">
          <InactivityReminderSection slug={slug} initial={program.inactivityReminder} />
        </div>
      )}

      {isAdmin && (
        <div className="mt-10 pt-8 border-t border-black/10">
          <ReferralSection slug={slug} initial={program.referralBonusPoints} />
        </div>
      )}

      {isAdmin && (
        <div className="mt-10 pt-8 border-t border-black/10">
          <OffPeakSection slug={slug} initial={program.offPeakBonus} />
        </div>
      )}

      {isAdmin && (
        <div className="mt-10 pt-8 border-t border-black/10">
          <PointsExpirySection slug={slug} initial={program.pointsExpiry} />
        </div>
      )}

      {isAdmin && (
        <div className="mt-10 pt-8 border-t border-black/10">
          <ConnectPosApiSection slug={slug} />
        </div>
      )}

      {isAdmin && (
        <div className="mt-10 pt-8 border-t border-black/10">
          <IntegrationSection slug={slug} />
        </div>
      )}
    </div>
  );
}

function ConnectPosApiSection({ slug }: { slug: string }) {
  const [status, setStatus] = useState<PosApiStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [providerName, setProviderName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getPosApiCredential(slug).then((s) => {
      setStatus(s);
      if (s.configured) {
        setProviderName(s.providerName);
        setApiBaseUrl(s.apiBaseUrl ?? "");
      }
    });
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      await savePosApiCredential(slug, {
        providerName: providerName.trim(),
        apiKey,
        apiBaseUrl: apiBaseUrl.trim() || undefined,
      });
      setSavedMessage("Enregistré");
      setEditing(false);
      setApiKey("");
      refresh();
    } catch {
      setError("Vérifiez les champs saisis.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    await removePosApiCredential(slug);
    setProviderName("");
    setApiBaseUrl("");
    refresh();
  }

  if (!status) return null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-black/45 mb-3">
        Connecter le logiciel de caisse
      </p>
      <p className="text-xs text-black/50 mb-3">
        Si votre logiciel de caisse (Zelty, Lightspeed, L'Addition…) vous a fourni une clé API, enregistrez-la ici.
        Elle est stockée de façon chiffrée, prête à être utilisée dès que le branchement spécifique à ce logiciel
        est mis en place.
      </p>

      {status.configured && !editing ? (
        <div className="rounded-2xl border border-black/10 bg-white p-4 flex flex-col gap-2">
          <p className="text-sm">
            Logiciel enregistré : <strong>{status.providerName}</strong>
          </p>
          <p className="text-xs text-black/40">
            {status.connectedAt
              ? "Branchement actif — les ventes créditent déjà les points automatiquement."
              : "Clé enregistrée, en attente du branchement spécifique à ce logiciel."}
          </p>
          {savedMessage && <p className="text-sm text-green-700">{savedMessage}</p>}
          <div className="flex gap-3 mt-1">
            <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-black/60 hover:text-black">
              Modifier
            </button>
            <button type="button" onClick={handleRemove} className="text-xs font-semibold text-red-600 hover:text-red-800">
              Supprimer
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="rounded-2xl border border-black/10 bg-white p-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Nom du logiciel</span>
            <input
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder="Ex: Zelty, Lightspeed, L'Addition…"
              className="rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Clé API</span>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              placeholder="Clé fournie par le logiciel de caisse"
              className="rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-black/45">
              URL de l'API (optionnel)
            </span>
            <input
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="Si le logiciel en fournit une"
              className="rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl py-2.5 px-5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
              style={{ background: "#171512" }}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            {status.configured && (
              <button type="button" onClick={() => setEditing(false)} className="text-sm text-black/50 hover:text-black">
                Annuler
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function IntegrationSection({ slug }: { slug: string }) {
  const [terminals, setTerminals] = useState<TerminalKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ label: string; apiKey: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string;

  const refresh = useCallback(() => {
    setLoading(true);
    listTerminals(slug)
      .then((res) => setTerminals(res.terminals))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const result = await createTerminalKey(slug, label.trim());
      setNewKey({ label: result.label, apiKey: result.apiKey });
      setCopied(false);
      setLabel("");
      refresh();
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(terminal: TerminalKey) {
    await setTerminalActive(slug, terminal.id, !terminal.active);
    refresh();
  }

  function handleCopy() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey.apiKey).then(() => setCopied(true));
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-black/45 mb-3">
        Intégration caisse / API externe
      </p>
      <p className="text-xs text-black/50 mb-3">
        Créez une clé API pour brancher votre logiciel de caisse (ou un automate Zapier/Make) : chaque vente peut
        alors créditer les points automatiquement, sans passer par l'écran de scan.
      </p>

      {newKey && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 mb-3 flex flex-col gap-2">
          <p className="text-sm text-black/70">
            Clé créée pour <strong>{newKey.label}</strong>. Copiez-la maintenant — elle ne sera plus jamais affichée.
          </p>
          <code className="text-xs font-mono break-all bg-white rounded-lg px-3 py-2 border border-black/10">
            {newKey.apiKey}
          </code>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="self-start rounded-xl py-2 px-4 text-xs font-bold uppercase tracking-wider text-white"
              style={{ background: "#171512" }}
            >
              {copied ? "Copié !" : "Copier la clé"}
            </button>
            <button type="button" onClick={() => setNewKey(null)} className="text-xs text-black/50 hover:text-black">
              Fermer
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-black/40 mb-3">Chargement…</p>
      ) : terminals.length > 0 ? (
        <ul className="flex flex-col gap-2 mb-3">
          {terminals.map((terminal) => (
            <li
              key={terminal.id}
              className={`rounded-xl border border-black/10 bg-white p-3.5 flex items-center gap-3 ${
                !terminal.active ? "opacity-50" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{terminal.label}</p>
                <p className="text-xs text-black/40">
                  {terminal.active ? "Active" : "Révoquée"} · créée le{" "}
                  {new Date(terminal.createdAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle(terminal)}
                className={`text-xs font-semibold flex-shrink-0 ${
                  terminal.active ? "text-red-600 hover:text-red-800" : "text-black/50 hover:text-black"
                }`}
              >
                {terminal.active ? "Révoquer" : "Réactiver"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-black/40 mb-3">Aucune clé pour le moment.</p>
      )}

      <form onSubmit={handleCreate} className="rounded-2xl border border-black/10 bg-white p-4 flex items-end gap-3 mb-3">
        <label className="flex flex-col gap-1.5 flex-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/45">
            Nom de l'intégration (ex: "Zelty")
          </span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
            required
          />
        </label>
        <button
          type="submit"
          disabled={creating}
          className="rounded-xl py-2.5 px-5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
          style={{ background: "#171512" }}
        >
          {creating ? "…" : "Créer une clé"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setShowDocs((v) => !v)}
        className="text-xs font-semibold text-black/50 hover:text-black"
      >
        {showDocs ? "Masquer la documentation" : "Voir comment brancher l'API"}
      </button>

      {showDocs && (
        <div className="mt-3 rounded-2xl border border-black/10 bg-black/[0.03] p-4 flex flex-col gap-3 text-xs text-black/70 leading-relaxed">
          <p>
            Deux appels HTTP suffisent, à faire depuis votre logiciel de caisse ou un automate (Zapier, Make…), en
            en-tête <code className="font-mono">X-Terminal-Key</code> avec la clé créée ci-dessus :
          </p>
          <div>
            <p className="font-semibold mb-1">1. Trouver le client (téléphone ou e-mail connu de la caisse)</p>
            <pre className="bg-white rounded-lg p-3 overflow-x-auto font-mono">
{`POST ${apiBaseUrl}/transactions/resolve-customer
X-Terminal-Key: <votre clé>
{ "phone": "0612345678" }
→ { "customerId": "..." }`}
            </pre>
          </div>
          <div>
            <p className="font-semibold mb-1">2. Créditer les points de l'achat</p>
            <pre className="bg-white rounded-lg p-3 overflow-x-auto font-mono">
{`POST ${apiBaseUrl}/transactions
X-Terminal-Key: <votre clé>
{ "customerId": "...", "amount": "37.50", "idempotencyKey": "<id unique de la vente>" }`}
            </pre>
          </div>
          <p className="text-black/40">
            "idempotencyKey" doit être l'identifiant unique de la vente côté caisse : si le même appel est renvoyé
            deux fois (retry réseau), les points ne sont crédités qu'une seule fois.
          </p>
        </div>
      )}
    </div>
  );
}

function ReferralSection({ slug, initial }: { slug: string; initial: number }) {
  const [bonusPoints, setBonusPoints] = useState(String(initial));
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedMessage(null);
    try {
      await updateReferralBonus(slug, Number(bonusPoints));
      setSavedMessage("Configuration enregistrée");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-black/45 mb-3">Parrainage</p>
      <p className="text-xs text-black/50 mb-3">
        À l'inscription, un nouveau client peut renseigner le numéro de fidélité d'un client existant qui l'a
        parrainé — les deux reçoivent alors ce nombre de points, en plus du point offert à toute inscription.
      </p>
      <form onSubmit={handleSave} className="rounded-2xl border border-black/10 bg-white p-4 flex items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/45">
            Points offerts (parrain + filleul)
          </span>
          <input
            value={bonusPoints}
            onChange={(e) => setBonusPoints(e.target.value)}
            inputMode="numeric"
            className="w-28 rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
            required
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl py-2.5 px-5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
          style={{ background: "#171512" }}
        >
          {saving ? "…" : "Enregistrer"}
        </button>
      </form>
      {savedMessage && <p className="text-sm text-green-700 mt-2">{savedMessage}</p>}
    </div>
  );
}

function OffPeakSection({ slug, initial }: { slug: string; initial: OffPeakBonusConfig }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [startHour, setStartHour] = useState(String(initial.startHour));
  const [endHour, setEndHour] = useState(String(initial.endHour));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      await updateOffPeakBonus(slug, { enabled, startHour: Number(startHour), endHour: Number(endHour) });
      setSavedMessage("Configuration enregistrée");
    } catch {
      setError("Vérifiez les heures saisies (l'heure de début doit différer de l'heure de fin).");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-black/45 mb-3">Heures creuses</p>
      <p className="text-xs text-black/50 mb-3">
        Les points sont automatiquement doublés sur les achats encaissés pendant ce créneau (heure de Paris).
      </p>
      <form onSubmit={handleSave} className="rounded-2xl border border-black/10 bg-white p-4 flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Activer les points doublés
        </label>
        <div className="flex gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-black/45">De (heure)</span>
            <input
              value={startHour}
              onChange={(e) => setStartHour(e.target.value)}
              inputMode="numeric"
              className="w-20 rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-black/45">À (heure)</span>
            <input
              value={endHour}
              onChange={(e) => setEndHour(e.target.value)}
              inputMode="numeric"
              className="w-20 rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
              required
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {savedMessage && <p className="text-sm text-green-700">{savedMessage}</p>}
        <button
          type="submit"
          disabled={saving}
          className="self-start rounded-xl py-2.5 px-5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
          style={{ background: "#171512" }}
        >
          {saving ? "…" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}

function PointsExpirySection({ slug, initial }: { slug: string; initial: PointsExpiryConfig }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [days, setDays] = useState(String(initial.days));
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedMessage(null);
    try {
      await updatePointsExpiry(slug, { enabled, days: Number(days) });
      setSavedMessage("Configuration enregistrée");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestNow() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await runPointsExpiryNow(slug);
      setTestResult(`${result.expiredCount} client(s) réinitialisé(s), ${result.totalPointsExpired} points expirés.`);
    } catch (err) {
      setTestResult(
        err instanceof ApiError && err.code === "EXPIRY_NOT_READY" ? "Activez l'expiration d'abord." : "Une erreur est survenue.",
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-black/45 mb-3">Expiration des points</p>
      <p className="text-xs text-black/50 mb-3">
        Le solde de points d'un client sans achat depuis ce délai est remis à zéro (le cumul total, lui, n'est
        jamais perdu).
      </p>
      <form onSubmit={handleSave} className="rounded-2xl border border-black/10 bg-white p-4 flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Activer l'expiration des points
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Délai (en jours)</span>
          <input
            value={days}
            onChange={(e) => setDays(e.target.value)}
            inputMode="numeric"
            className="w-28 rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
            required
          />
        </label>
        {savedMessage && <p className="text-sm text-green-700">{savedMessage}</p>}
        {testResult && <p className="text-sm text-black/60">{testResult}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl py-2.5 px-5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
            style={{ background: "#171512" }}
          >
            {saving ? "…" : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={handleTestNow}
            disabled={testing}
            className="text-xs font-semibold text-black/50 hover:text-black disabled:opacity-50"
          >
            {testing ? "Test en cours…" : "Tester maintenant"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EmailConfigSection({ slug }: { slug: string }) {
  const [status, setStatus] = useState<EmailConfigStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getEmailConfig(slug).then((s) => {
      setStatus(s);
      if (s.configured) setFromAddress(s.fromAddress);
    });
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      await saveEmailConfig(slug, {
        smtpHost: "smtp.resend.com",
        smtpPort: 465,
        smtpSecure: true,
        smtpUser: "resend",
        smtpPassword,
        fromAddress: fromAddress.trim(),
      });
      setSavedMessage("Configuration enregistrée");
      setEditing(false);
      setSmtpPassword("");
      refresh();
    } catch {
      setError("Vérifiez les champs saisis.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    await removeEmailConfig(slug);
    refresh();
  }

  if (!status) return null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-black/45 mb-3">
        E-mail (Resend — pour les notifications clients)
      </p>

      {status.configured && !editing ? (
        <div className="rounded-2xl border border-black/10 bg-white p-4 flex flex-col gap-2">
          <p className="text-sm">
            Envoi configuré depuis <strong>{status.fromAddress}</strong> (compte Resend propre à cette entreprise)
          </p>
          {savedMessage && <p className="text-sm text-green-700">{savedMessage}</p>}
          <div className="flex gap-3 mt-1">
            <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-black/60 hover:text-black">
              Modifier
            </button>
            <button type="button" onClick={handleRemove} className="text-xs font-semibold text-red-600 hover:text-red-800">
              Revenir au compte partagé
            </button>
          </div>
        </div>
      ) : !status.configured && status.usingPlatformDefault && !editing ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 flex flex-col gap-2">
          <p className="text-sm text-green-800">
            ✓ Actif — les e-mails automatiques fonctionnent déjà via le compte partagé de la plateforme, sans rien à
            configurer.
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="self-start text-xs font-semibold text-black/60 hover:text-black mt-1"
          >
            Utiliser ma propre adresse d'expédition à la place
          </button>
        </div>
      ) : (
        <form onSubmit={handleSave} className="rounded-2xl border border-black/10 bg-white p-4 flex flex-col gap-3">
          <p className="text-xs text-black/50 leading-relaxed">
            Créez un compte gratuit sur <span className="font-mono">resend.com</span> (jusqu'à 3000 e-mails/mois),
            allez dans "API Keys", créez-en une et collez-la ici.
          </p>
          <input
            value={smtpPassword}
            onChange={(e) => setSmtpPassword(e.target.value)}
            type="password"
            placeholder="Clé API Resend (commence par re_)"
            className="rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
            required
          />
          <input
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
            type="email"
            placeholder="Adresse d'expédition"
            className="rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
            required
          />
          <p className="text-xs text-black/40 -mt-1">
            Pas encore de domaine vérifié sur Resend ? Utilisez <span className="font-mono">onboarding@resend.dev</span>{" "}
            pour tester sans configuration DNS.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl py-2.5 px-5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
              style={{ background: "#171512" }}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            {(status.configured || status.usingPlatformDefault) && (
              <button type="button" onClick={() => setEditing(false)} className="text-sm text-black/50 hover:text-black">
                Annuler
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function InactivityReminderSection({ slug, initial }: { slug: string; initial: InactivityReminderConfig }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [thresholdDays, setThresholdDays] = useState(String(initial.thresholdDays));
  const [subject, setSubject] = useState(initial.subject);
  const [message, setMessage] = useState(initial.message);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      await updateInactivityReminder(slug, {
        enabled,
        thresholdDays: Number(thresholdDays),
        subject: subject.trim(),
        message: message.trim(),
      });
      setSavedMessage("Configuration enregistrée");
    } catch {
      setError("Vérifiez les champs saisis.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestNow() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await runInactivityReminderNow(slug);
      setTestResult(`${result.sent} e-mail(s) envoyé(s), ${result.failed} échec(s).`);
    } catch (err) {
      setTestResult(
        err instanceof ApiError && err.code === "REMINDER_NOT_READY"
          ? "Activez la relance et configurez Resend d'abord."
          : "Une erreur est survenue.",
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-black/45 mb-3">Relance automatique</p>
      <p className="text-xs text-black/50 mb-3">
        Envoie automatiquement cet e-mail à tout client encore actif mais sans achat depuis le délai choisi — répété
        tant qu'il reste inactif (jamais plus d'une fois par période). Nécessite Resend configuré ci-dessus.
      </p>

      <form onSubmit={handleSave} className="rounded-2xl border border-black/10 bg-white p-4 flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Activer la relance automatique
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/45">
            Délai d'inactivité (en jours)
          </span>
          <input
            value={thresholdDays}
            onChange={(e) => setThresholdDays(e.target.value)}
            inputMode="numeric"
            className="w-28 rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Objet</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30 resize-none"
            required
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {savedMessage && <p className="text-sm text-green-700">{savedMessage}</p>}
        {testResult && <p className="text-sm text-black/60">{testResult}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl py-2.5 px-5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
            style={{ background: "#171512" }}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={handleTestNow}
            disabled={testing}
            className="text-xs font-semibold text-black/50 hover:text-black disabled:opacity-50"
          >
            {testing ? "Test en cours…" : "Tester maintenant"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RewardsSection({
  slug,
  rewards,
  isAdmin,
  onChanged,
}: {
  slug: string;
  rewards: Reward[];
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [pointsCost, setPointsCost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createReward(slug, { name: name.trim(), pointsCost: Number(pointsCost) });
      setName("");
      setPointsCost("");
      onChanged();
    } catch {
      setError("Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(reward: Reward) {
    await updateReward(slug, reward.id, { active: !reward.active });
    onChanged();
  }

  async function handleDelete(reward: Reward) {
    await deleteReward(slug, reward.id);
    onChanged();
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-black/45 mb-3">Catalogue de récompenses</p>

      {rewards.length === 0 ? (
        <p className="text-sm text-black/40 mb-4">Aucune récompense pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-2 mb-4">
          {rewards.map((reward) => (
            <li
              key={reward.id}
              className={`rounded-xl border border-black/10 bg-white p-3.5 flex items-center gap-3 ${
                !reward.active ? "opacity-50" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{reward.name}</p>
                <p className="text-xs text-black/40">{reward.pointsCost} points</p>
              </div>
              {isAdmin && (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(reward)}
                    className="text-xs text-black/50 hover:text-black"
                  >
                    {reward.active ? "Désactiver" : "Réactiver"}
                  </button>
                  <button type="button" onClick={() => handleDelete(reward)} className="text-xs text-red-600 hover:text-red-800">
                    Supprimer
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-black/10 bg-white p-4 flex flex-col gap-3">
          <div className="flex gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom (ex: Café offert)"
              className="flex-1 rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
              required
            />
            <input
              value={pointsCost}
              onChange={(e) => setPointsCost(e.target.value)}
              placeholder="Points"
              inputMode="numeric"
              className="w-24 rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl py-2.5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
            style={{ background: "#171512" }}
          >
            Ajouter une récompense
          </button>
        </form>
      )}
    </div>
  );
}

function TiersSection({
  slug,
  tiers,
  isAdmin,
  onChanged,
}: {
  slug: string;
  tiers: DiscountTier[];
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [label, setLabel] = useState("");
  const [thresholdPoints, setThresholdPoints] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createDiscountTier(slug, {
        label: label.trim(),
        thresholdPoints: Number(thresholdPoints),
        discountPercent,
      });
      setLabel("");
      setThresholdPoints("");
      setDiscountPercent("");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError && err.code === "THRESHOLD_ALREADY_USED" ? "Ce seuil est déjà utilisé." : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(tier: DiscountTier) {
    await deleteDiscountTier(slug, tier.id);
    onChanged();
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-black/45 mb-3">Paliers de réduction</p>
      <p className="text-xs text-black/40 mb-3">
        Le client passe automatiquement au palier suivant selon son cumul total de points gagnés.
      </p>

      {tiers.length === 0 ? (
        <p className="text-sm text-black/40 mb-4">Aucun palier pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-2 mb-4">
          {tiers.map((tier) => (
            <li key={tier.id} className="rounded-xl border border-black/10 bg-white p-3.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{tier.label}</p>
                <p className="text-xs text-black/40">
                  À partir de {tier.thresholdPoints} points cumulés → {tier.discountPercent}%
                </p>
              </div>
              {isAdmin && (
                <button type="button" onClick={() => handleDelete(tier)} className="text-xs text-red-600 hover:text-red-800 flex-shrink-0">
                  Supprimer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-black/10 bg-white p-4 flex flex-col gap-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nom du palier (ex: Argent)"
            className="rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
            required
          />
          <div className="flex gap-3">
            <input
              value={thresholdPoints}
              onChange={(e) => setThresholdPoints(e.target.value)}
              placeholder="Seuil (points cumulés)"
              inputMode="numeric"
              className="flex-1 rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
              required
            />
            <input
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              placeholder="% réduction"
              inputMode="decimal"
              className="w-28 rounded-xl border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-black/30"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl py-2.5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
            style={{ background: "#171512" }}
          >
            Ajouter un palier
          </button>
        </form>
      )}
    </div>
  );
}
