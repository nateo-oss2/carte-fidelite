import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { adminResetPassword, ApiError } from "../lib/adminApi";

export function AdminResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await adminResetPassword(token, newPassword);
      navigate("/admin/login");
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "INVALID_OR_EXPIRED_TOKEN"
          ? "Ce lien n'est plus valide — demandez-en un nouveau."
          : "Vérifiez votre mot de passe (10 caractères minimum).",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center text-sm text-black/50">
        Lien invalide.
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-4">
        <h1
          className="text-lg font-bold uppercase tracking-widest text-center mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Nouveau mot de passe
        </h1>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Mot de passe</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/30"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-2xl py-3.5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
          style={{ background: "#171512" }}
        >
          {submitting ? "Enregistrement…" : "Changer le mot de passe"}
        </button>

        <Link to="/admin/login" className="text-xs text-black/40 hover:text-black/70 text-center">
          Retour à la connexion
        </Link>
      </form>
    </div>
  );
}
