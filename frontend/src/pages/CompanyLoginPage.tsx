import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { companyLogin, ApiError } from "../lib/companyApi";

export function CompanyLoginPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await companyLogin(slug, email.trim().toLowerCase(), password);
      navigate(`/company/${slug}`);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "INVALID_CREDENTIALS"
          ? "E-mail ou mot de passe incorrect."
          : "Une erreur est survenue.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-4">
        <h1
          className="text-lg font-bold uppercase tracking-widest text-center mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Espace entreprise
        </h1>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/45">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/30"
            autoComplete="email"
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Mot de passe</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/30"
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-2xl py-3.5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
          style={{ background: "#171512" }}
        >
          {submitting ? "Connexion…" : "Se connecter"}
        </button>

        <Link to={`/company/${slug}/forgot-password`} className="text-xs text-black/40 hover:text-black/70 text-center">
          Mot de passe oublié ?
        </Link>
      </form>
    </div>
  );
}
