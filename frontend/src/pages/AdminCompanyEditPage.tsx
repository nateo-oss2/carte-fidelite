import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  adminMe,
  createCompanyEmployee,
  deleteAdminCompany,
  getAdminCompany,
  qrCodeUrl,
  reactivateCompany,
  suspendCompany,
  updateAdminCompany,
  uploadCompanyLogo,
  ApiError,
  type CompanyDetail,
  type CreateEmployeeResponse,
} from "../lib/adminApi";
import { WalletCardPreview, type CardTemplate } from "../components/WalletCardPreview";

const CARD_TEMPLATES: { value: CardTemplate; label: string }[] = [
  { value: "BANNER", label: "Bandeau" },
  { value: "GRADIENT", label: "Dégradé" },
  { value: "FRAME", label: "Cadre" },
  { value: "SPLIT", label: "Split" },
];

export function AdminCompanyEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [checkingSession, setCheckingSession] = useState(true);
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [name, setName] = useState("");
  const [programName, setProgramName] = useState("");
  const [accentColor, setAccentColor] = useState("#B08D57");
  const [secondaryColorEnabled, setSecondaryColorEnabled] = useState(false);
  const [secondaryColor, setSecondaryColor] = useState("#171512");
  const [cardTemplate, setCardTemplate] = useState<CardTemplate>("BANNER");
  const [pointsRule, setPointsRule] = useState("1");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminMe()
      .then(() => setCheckingSession(false))
      .catch(() => navigate("/admin/login"));
  }, [navigate]);

  useEffect(() => {
    if (checkingSession) return;
    getAdminCompany(id).then((c) => {
      setCompany(c);
      setName(c.name);
      setProgramName(c.programName);
      setAccentColor(c.accentColor);
      setSecondaryColorEnabled(Boolean(c.secondaryColor));
      setSecondaryColor(c.secondaryColor ?? "#171512");
      setCardTemplate(c.cardTemplate);
      setPointsRule(c.pointsPerCurrencyUnit);
      setLogoPreview(c.logoUrl);
    });
  }, [checkingSession, id]);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Aperçu instantané avant même que l'upload soit terminé.
    setLogoPreview(URL.createObjectURL(file));
    setUploadingLogo(true);
    setError(null);
    try {
      const { logoUrl } = await uploadCompanyLogo(id, file);
      setLogoPreview(logoUrl);
      setSavedMessage("Logo mis à jour");
    } catch {
      setError("Le logo n'a pas pu être envoyé (PNG/JPEG/WEBP, 2 Mo max).");
      setLogoPreview(company?.logoUrl ?? null);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const updated = await updateAdminCompany(id, {
        name: name.trim(),
        programName: programName.trim(),
        accentColor,
        secondaryColor: secondaryColorEnabled ? secondaryColor : "",
        cardTemplate,
        pointsPerCurrencyUnit: pointsRule,
      });
      setCompany((prev) => (prev ? { ...prev, ...updated } : prev));
      setSavedMessage("Modifications enregistrées");
    } catch (err) {
      setError(err instanceof ApiError ? "Vérifiez les champs saisis." : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  if (checkingSession || !company) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-black/40">Chargement…</div>;
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-md mx-auto">
      <Link to="/admin" className="text-xs text-black/40 hover:text-black/70">
        ← Retour aux entreprises
      </Link>

      <div className="flex items-center justify-between mt-4 mb-6">
        <h1 className="text-lg font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>
          {company.name}
        </h1>
        <StatusToggle
          companyId={id}
          status={company.status}
          onChanged={(status) => setCompany((prev) => (prev ? { ...prev, status } : prev))}
        />
      </div>

      <div
        className="rounded-xl py-6 mb-6"
        style={{ background: "linear-gradient(180deg, #f3f2f0 0%, #eae8e5 100%)" }}
      >
        <WalletCardPreview
          companyName={name}
          accentColor={accentColor}
          secondaryColor={secondaryColorEnabled ? secondaryColor : null}
          cardTemplate={cardTemplate}
          logoUrl={logoPreview}
        />
      </div>

      <div className="mb-6 flex flex-col items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleLogoChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingLogo}
          className="text-xs font-semibold uppercase tracking-wide text-black/60 hover:text-black disabled:opacity-50"
        >
          {uploadingLogo ? "Envoi…" : logoPreview ? "Changer le logo" : "Ajouter un logo"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-black/10 bg-white p-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Nom de l'entreprise</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/30"
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Nom du programme</span>
          <input
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/30"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Couleur d'accent</span>
          <input
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="h-11 w-16 rounded-lg border border-black/10"
          />
          <span className="text-xs text-black/40">
            C'est la seule couleur reprise sur la vraie carte Apple Wallet (fond uni) — le modèle et la 2e couleur
            ci-dessous ne s'appliquent que sur le dashboard, la page d'inscription et la fiche client.
          </span>
        </label>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-black/45">
            <input
              type="checkbox"
              checked={secondaryColorEnabled}
              onChange={(e) => setSecondaryColorEnabled(e.target.checked)}
              className="rounded border-black/20"
            />
            2e couleur (dégradé, optionnel)
          </label>
          {secondaryColorEnabled && (
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="h-11 w-16 rounded-lg border border-black/10"
            />
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Modèle de carte</span>
          <div className="grid grid-cols-2 gap-2">
            {CARD_TEMPLATES.map((tpl) => (
              <button
                key={tpl.value}
                type="button"
                onClick={() => setCardTemplate(tpl.value)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border py-2 ${
                  cardTemplate === tpl.value ? "border-black/60 bg-black/5" : "border-black/10"
                }`}
              >
                <div className="scale-[0.4] origin-center -my-6">
                  <WalletCardPreview
                    companyName={name}
                    accentColor={accentColor}
                    secondaryColor={secondaryColorEnabled ? secondaryColor : null}
                    cardTemplate={tpl.value}
                    logoUrl={logoPreview}
                  />
                </div>
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    cardTemplate === tpl.value ? "text-black" : "text-black/50"
                  }`}
                >
                  {tpl.label}
                </span>
              </button>
            ))}
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/45">
            Règle de points (points par € dépensé)
          </span>
          <input
            value={pointsRule}
            onChange={(e) => setPointsRule(e.target.value)}
            inputMode="decimal"
            className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/30"
          />
          <span className="text-xs text-black/40">
            Ex : "1" → 1€ dépensé = 1 point. "2" → 1€ dépensé = 2 points. "0.5" → 2€ dépensés = 1 point.
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {savedMessage && !error && <p className="text-sm text-green-700">{savedMessage}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-2 rounded-2xl py-3.5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
          style={{ background: "#171512" }}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-2">
        <img src={qrCodeUrl(company.joinToken)} alt="QR code" className="w-28 h-28" />
        <p className="text-xs text-black/40">QR code d'inscription</p>
      </div>

      <CompanyAccessSection companyId={id} />

      <div className="mt-10 pt-6 border-t border-black/10">
        <DeleteCompanyZone companyId={id} companyName={company.name} />
      </div>
    </div>
  );
}

function DeleteCompanyZone({ companyId, companyName }: { companyId: string; companyName: string }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteAdminCompany(companyId);
      navigate("/admin");
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "COMPANY_NOT_EMPTY"
          ? "Impossible : cette entreprise a des clients ou des transactions. Suspendez-la plutôt, pour ne pas perdre son historique."
          : "Une erreur est survenue.",
      );
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  }

  if (confirming) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex flex-col gap-3">
        <p className="text-sm text-red-700">
          Supprimer définitivement <strong>{companyName}</strong> ? Cette action est irréversible.
        </p>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-xl py-2.5 px-5 text-sm font-bold uppercase tracking-wider text-white bg-red-600 disabled:opacity-60"
          >
            {deleting ? "Suppression…" : "Oui, supprimer"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="text-sm text-black/50 hover:text-black">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-semibold uppercase tracking-wide text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg"
      >
        Supprimer cette entreprise
      </button>
    </div>
  );
}

function StatusToggle({
  companyId,
  status,
  onChanged,
}: {
  companyId: string;
  status: string;
  onChanged: (status: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const isActive = status === "ACTIVE";

  async function handleClick() {
    setBusy(true);
    try {
      const result = isActive ? await suspendCompany(companyId) : await reactivateCompany(companyId);
      onChanged(result.status);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-lg disabled:opacity-50 ${
        isActive ? "text-red-600 hover:bg-red-50" : "text-green-700 hover:bg-green-50"
      }`}
    >
      {busy ? "…" : isActive ? "Suspendre" : "Réactiver"}
    </button>
  );
}

function CompanyAccessSection({ companyId }: { companyId: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateEmployeeResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const result = await createCompanyEmployee(companyId, { name: name.trim(), email: email.trim() });
      setCreated(result);
      setCopied(false);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "EMPLOYEE_EMAIL_ALREADY_EXISTS"
          ? "Un accès existe déjà avec cet e-mail pour cette entreprise."
          : "Une erreur est survenue.",
      );
    } finally {
      setCreating(false);
    }
  }

  function handleCopy() {
    if (!created) return;
    const text = `Lien : ${created.loginUrl}\nE-mail : ${created.email}\nMot de passe : ${created.temporaryPassword}`;
    navigator.clipboard.writeText(text).then(() => setCopied(true));
  }

  return (
    <div className="mt-8 rounded-2xl border border-black/10 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/45 mb-4">Accès entreprise</p>

      {created ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-black/70">
            Accès créé pour <strong>{created.name}</strong>. Copiez ces informations maintenant — le
            mot de passe ne sera plus jamais affiché.
          </p>
          <div className="rounded-xl bg-black/[0.04] p-4 text-xs font-mono flex flex-col gap-1.5 break-all">
            <span>Lien : {created.loginUrl}</span>
            <span>E-mail : {created.email}</span>
            <span>Mot de passe : {created.temporaryPassword}</span>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-xl py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-white"
              style={{ background: "#171512" }}
            >
              {copied ? "Copié !" : "Copier"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setName("");
                setEmail("");
              }}
              className="text-xs text-black/50 hover:text-black"
            >
              Créer un autre accès
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <p className="text-xs text-black/50 -mt-1">
            Génère les identifiants de connexion à remettre à l'entreprise une fois le contrat signé.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Nom du contact</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/30"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-black/45">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/30"
              required
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={creating}
            className="rounded-xl py-3 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
            style={{ background: "#171512" }}
          >
            {creating ? "Création…" : "Créer un accès"}
          </button>
        </form>
      )}
    </div>
  );
}
