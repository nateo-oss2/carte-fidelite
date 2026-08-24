import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { companyForgotPassword } from "../lib/companyApi";

export function CompanyForgotPasswordPage() {
  const { slug = "" } = useParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await companyForgotPassword(slug, email.trim().toLowerCase());
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-xs flex flex-col gap-4">
        <h1
          className="text-lg font-bold uppercase tracking-widest text-center mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Mot de passe oublié
        </h1>

        {sent ? (
          <p className="text-sm text-black/60 text-center">
            Si un compte existe avec cet e-mail, un lien de réinitialisation vient d'être envoyé.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            <button
              type="submit"
              disabled={submitting}
              className="rounded-2xl py-3.5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
              style={{ background: "#171512" }}
            >
              {submitting ? "Envoi…" : "Envoyer le lien"}
            </button>
          </form>
        )}

        <Link to={`/company/${slug}/login`} className="text-xs text-black/40 hover:text-black/70 text-center">
          Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
