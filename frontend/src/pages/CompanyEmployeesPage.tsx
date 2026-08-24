import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  companyMe,
  createEmployee,
  listEmployees,
  updateEmployee,
  ApiError,
  type Employee,
} from "../lib/companyApi";

export function CompanyEmployeesPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    listEmployees(slug)
      .then((res) => setEmployees(res.employees))
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

  async function handleToggleActive(employee: Employee) {
    setError(null);
    try {
      await updateEmployee(slug, employee.id, { active: !employee.active });
      refresh();
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "LAST_ADMIN_CANNOT_BE_REMOVED"
          ? "Impossible : ce serait le dernier administrateur actif de l'entreprise."
          : "Une erreur est survenue.",
      );
    }
  }

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-black/40">Chargement…</div>;
  }

  if (role !== "ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center text-sm text-black/50">
        Seul un administrateur de l'entreprise peut gérer les employés.
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-md mx-auto">
      <Link to={`/company/${slug}`} className="text-xs text-black/40 hover:text-black/70">
        ← Retour au dashboard
      </Link>

      <h1 className="text-lg font-bold uppercase tracking-widest mt-4 mb-6" style={{ fontFamily: "var(--font-display)" }}>
        Employés
      </h1>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {created ? (
        <div className="rounded-2xl border border-black/10 bg-white p-5 mb-6 flex flex-col gap-3">
          <p className="text-sm text-black/70">
            Accès créé. Copiez ces informations maintenant — le mot de passe ne sera plus jamais affiché.
          </p>
          <div className="rounded-xl bg-black/[0.04] p-4 text-xs font-mono flex flex-col gap-1.5 break-all">
            <span>E-mail : {created.email}</span>
            <span>Mot de passe : {created.temporaryPassword}</span>
          </div>
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="self-start text-xs font-semibold text-black/60 hover:text-black"
          >
            Fermer
          </button>
        </div>
      ) : (
        <CreateEmployeeForm
          slug={slug}
          onCreated={(res) => {
            setCreated(res);
            refresh();
          }}
        />
      )}

      {loading ? (
        <p className="text-sm text-black/40">Chargement…</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {employees.map((employee) => (
            <li key={employee.id} className="rounded-2xl border border-black/10 bg-white p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{employee.name}</p>
                <p className="text-xs text-black/40">
                  {employee.email} · {employee.role}
                  {!employee.active && " · désactivé"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleActive(employee)}
                className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-lg ${
                  employee.active ? "text-red-600 hover:bg-red-50" : "text-green-700 hover:bg-green-50"
                }`}
              >
                {employee.active ? "Désactiver" : "Réactiver"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateEmployeeForm({
  slug,
  onCreated,
}: {
  slug: string;
  onCreated: (res: { email: string; temporaryPassword: string }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleField, setRoleField] = useState("EMPLOYEE");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await createEmployee(slug, { name: name.trim(), email: email.trim(), role: roleField });
      onCreated(res);
      setName("");
      setEmail("");
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "EMPLOYEE_EMAIL_ALREADY_EXISTS"
          ? "Cet e-mail est déjà utilisé."
          : "Une erreur est survenue.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-black/10 bg-white p-5 mb-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Nom</span>
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
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Rôle</span>
        <select
          value={roleField}
          onChange={(e) => setRoleField(e.target.value)}
          className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/30"
        >
          <option value="EMPLOYEE">Employé — scan et encaissement uniquement</option>
          <option value="MANAGER">Manager — peut aussi révoquer une carte</option>
          <option value="ADMIN">Admin — accès complet, gère les employés</option>
        </select>
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
  );
}
