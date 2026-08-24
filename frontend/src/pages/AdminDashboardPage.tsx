import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  adminLogout,
  adminMe,
  createAdminCompany,
  listAdminCompanies,
  qrCodeUrl,
  ApiError,
  type AdminCompany,
  type CreateCompanyResponse,
} from "../lib/adminApi";
import { WalletCardPreview } from "../components/WalletCardPreview";

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [justCreated, setJustCreated] = useState<CreateCompanyResponse | null>(null);

  const refreshCompanies = useCallback(() => {
    setLoadingCompanies(true);
    listAdminCompanies()
      .then((res) => setCompanies(res.companies))
      .finally(() => setLoadingCompanies(false));
  }, []);

  useEffect(() => {
    adminMe()
      .then(() => setCheckingSession(false))
      .catch(() => navigate("/admin/login"));
  }, [navigate]);

  useEffect(() => {
    if (!checkingSession) refreshCompanies();
  }, [checkingSession, refreshCompanies]);

  async function handleLogout() {
    await adminLogout();
    navigate("/admin/login");
  }

  if (checkingSession) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-black/40">Chargement…</div>;
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-lg font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>
          Entreprises
        </h1>
        <div className="flex items-center gap-4">
          <Link to="/admin/audit-logs" className="text-xs text-black/50 hover:text-black">
            Journal d'audit
          </Link>
          <Link to="/admin/security" className="text-xs text-black/50 hover:text-black">
            Sécurité
          </Link>
          <button onClick={handleLogout} className="text-xs text-black/40 hover:text-black/70">
            Déconnexion
          </button>
        </div>
      </div>

      {justCreated && (
        <div className="mb-6 rounded-2xl border border-black/10 bg-white p-5 flex flex-col gap-3">
          <p className="text-sm font-semibold">{justCreated.name} a été créée</p>
          <img src={qrCodeUrl(justCreated.joinToken)} alt="QR code" className="w-32 h-32" />
          <p className="text-xs text-black/50 break-all">{justCreated.joinToken}</p>
          <button
            onClick={() => setJustCreated(null)}
            className="self-start text-xs font-semibold text-black/60 hover:text-black"
          >
            Fermer
          </button>
        </div>
      )}

      {showForm ? (
        <CreateCompanyForm
          onCreated={(company) => {
            setShowForm(false);
            setJustCreated(company);
            refreshCompanies();
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="mb-6 rounded-2xl border border-dashed border-black/20 py-4 w-full text-sm font-semibold text-black/60 hover:border-black/40 hover:text-black"
        >
          + Nouvelle entreprise
        </button>
      )}

      {loadingCompanies ? (
        <p className="text-sm text-black/40">Chargement…</p>
      ) : companies.length === 0 ? (
        <p className="text-sm text-black/40">Aucune entreprise pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {companies.map((company) => (
            <li key={company.id}>
              <Link
                to={`/admin/companies/${company.id}`}
                className="rounded-2xl border border-black/10 bg-white p-4 flex items-center gap-4 hover:border-black/25 transition-colors"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: company.accentColor }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {company.name}
                    {company.status !== "ACTIVE" && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-red-600">
                        Suspendue
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-black/40">
                    {company.customersCount} client{company.customersCount === 1 ? "" : "s"} ·{" "}
                    {company.transactionsCount} transaction{company.transactionsCount === 1 ? "" : "s"}
                  </p>
                </div>
                <img src={qrCodeUrl(company.joinToken)} alt="QR code" className="w-12 h-12 flex-shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateCompanyForm({
  onCreated,
  onCancel,
}: {
  onCreated: (company: CreateCompanyResponse) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [programName, setProgramName] = useState("");
  const [accentColor, setAccentColor] = useState("#B08D57");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const company = await createAdminCompany({
        name: name.trim(),
        programName: programName.trim() || undefined,
        accentColor,
      });
      onCreated(company);
      setName("");
      setProgramName("");
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "SLUG_ALREADY_TAKEN"
          ? "Une entreprise avec un nom très similaire existe déjà."
          : "Une erreur est survenue.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-black/10 bg-white p-5 flex flex-col gap-4">
      <div
        className="rounded-xl py-6 -mx-1"
        style={{ background: "linear-gradient(180deg, #f3f2f0 0%, #eae8e5 100%)" }}
      >
        <WalletCardPreview companyName={name} accentColor={accentColor} />
      </div>

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
        <span className="text-xs font-semibold uppercase tracking-wide text-black/45">
          Nom du programme (optionnel)
        </span>
        <input
          value={programName}
          onChange={(e) => setProgramName(e.target.value)}
          placeholder="Programme fidélité"
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
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl py-3 px-5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
          style={{ background: "#171512" }}
        >
          {submitting ? "Création…" : "Créer"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-black/50 hover:text-black">
          Annuler
        </button>
      </div>
    </form>
  );
}
