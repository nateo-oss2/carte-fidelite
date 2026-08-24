import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { companyMe, createTerminal, listTerminals, updateTerminal, type Terminal } from "../lib/companyApi";

export function CompanyTerminalsPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [created, setCreated] = useState<{ label: string; apiKey: string } | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    listTerminals(slug)
      .then((res) => setTerminals(res.terminals))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    companyMe(slug)
      .then((me) => setRole(me.role))
      .catch(() => navigate(`/company/${slug}/login`))
      .finally(() => setChecking(false));
  }, [slug, navigate]);

  useEffect(() => {
    if (!checking && role === "ADMIN") refresh();
  }, [checking, role, refresh]);

  async function handleToggleActive(terminal: Terminal) {
    await updateTerminal(slug, terminal.id, !terminal.active);
    refresh();
  }

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-black/40">Chargement…</div>;
  }

  if (role !== "ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center text-sm text-black/50">
        Seul un administrateur de l'entreprise peut gérer les terminaux.
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-md mx-auto">
      <Link to={`/company/${slug}`} className="text-xs text-black/40 hover:text-black/70">
        ← Retour au dashboard
      </Link>

      <h1 className="text-lg font-bold uppercase tracking-widest mt-4 mb-1" style={{ fontFamily: "var(--font-display)" }}>
        Terminaux
      </h1>
      <p className="text-xs text-black/40 mb-6">
        Un terminal représente un poste de caisse ou une douchette de scan. Chaque appareil utilisé pour scanner des
        cartes doit avoir sa propre clé.
      </p>

      {created ? (
        <div className="rounded-2xl border border-black/10 bg-white p-5 mb-6 flex flex-col gap-3">
          <p className="text-sm text-black/70">
            Terminal « {created.label} » créé. Copiez cette clé maintenant — elle ne sera plus jamais affichée.
          </p>
          <div className="rounded-xl bg-black/[0.04] p-4 text-xs font-mono break-all">{created.apiKey}</div>
          <p className="text-xs text-black/40">
            Pour activer ce poste directement sur cet appareil, ouvrez la page{" "}
            <Link to={`/company/${slug}/scan`} className="underline">
              Scan
            </Link>{" "}
            et collez cette clé — elle sera enregistrée une seule fois sur cet appareil.
          </p>
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="self-start text-xs font-semibold text-black/60 hover:text-black"
          >
            Fermer
          </button>
        </div>
      ) : (
        <CreateTerminalForm
          slug={slug}
          onCreated={(res) => {
            setCreated(res);
            refresh();
          }}
        />
      )}

      {loading ? (
        <p className="text-sm text-black/40">Chargement…</p>
      ) : terminals.length === 0 ? (
        <p className="text-sm text-black/40">Aucun terminal pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {terminals.map((terminal) => (
            <li key={terminal.id} className="rounded-2xl border border-black/10 bg-white p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{terminal.label}</p>
                <p className="text-xs text-black/40">{terminal.active ? "Actif" : "Désactivé"}</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleActive(terminal)}
                className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-lg ${
                  terminal.active ? "text-red-600 hover:bg-red-50" : "text-green-700 hover:bg-green-50"
                }`}
              >
                {terminal.active ? "Désactiver" : "Réactiver"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateTerminalForm({
  slug,
  onCreated,
}: {
  slug: string;
  onCreated: (res: { label: string; apiKey: string }) => void;
}) {
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await createTerminal(slug, label.trim());
      onCreated({ label: res.label, apiKey: res.apiKey });
      setLabel("");
    } catch {
      setError("Une erreur est survenue.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-black/10 bg-white p-5 mb-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Nom du poste</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex : Caisse 1"
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
        {creating ? "Création…" : "Créer un terminal"}
      </button>
    </form>
  );
}
