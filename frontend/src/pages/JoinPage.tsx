import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ApiError,
  applePassDownloadUrl,
  fetchCompanyByJoinToken,
  googleWalletSaveUrl,
  joinCompanyProgram,
  type CompanyPublicInfo,
  type JoinResponse,
} from "../lib/api";
import { ArchMark } from "../components/ArchMark";
import { detectWalletPlatform } from "../lib/device";
import { describePointsRule } from "../lib/pointsRule";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; company: CompanyPublicInfo };

export function JoinPage() {
  const { companyToken = "" } = useParams();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<JoinResponse | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchCompanyByJoinToken(companyToken)
      .then((company) => {
        if (!cancelled) setLoadState({ status: "ready", company });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setLoadState({ status: "not-found" });
        } else {
          setLoadState({ status: "error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [companyToken]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const response = await joinCompanyProgram(companyToken, {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        referralCode: referralCode.trim() || undefined,
      });
      setResult(response);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError && err.code === "INVALID_INPUT"
          ? "Vérifiez les informations saisies (l'e-mail doit être valide)."
          : "Une erreur est survenue. Réessayez dans un instant.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadState.status === "loading") {
    return <CenteredMessage>Chargement…</CenteredMessage>;
  }

  if (loadState.status === "not-found") {
    return (
      <CenteredMessage>
        <p className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>
          Programme introuvable
        </p>
        <p className="text-sm text-black/50 mt-2">
          Ce lien d'inscription n'est plus valide. Contactez l'établissement pour obtenir un
          nouveau QR code.
        </p>
      </CenteredMessage>
    );
  }

  if (loadState.status === "error") {
    return (
      <CenteredMessage>
        <p className="text-sm text-black/50">
          Impossible de charger cette page pour le moment. Réessayez dans un instant.
        </p>
      </CenteredMessage>
    );
  }

  const { company } = loadState;

  if (result) {
    return <ConfirmationView company={company} result={result} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 mb-10">
          <ArchMark color={company.accentColor} />
          <div className="flex flex-col items-center gap-2 text-center">
            <h1
              className="text-lg font-bold uppercase tracking-widest"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {company.companyName}
            </h1>
            <div className="w-6 h-0.5 rounded-full" style={{ background: company.accentColor }} />
          </div>
          <p className="text-sm text-black/60 text-center">
            Rejoignez {company.programName} — {describePointsRule(company.pointsPerCurrencyUnit)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
                autoComplete="given-name"
              />
            </Field>
            <Field label="Nom">
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass}
                autoComplete="family-name"
              />
            </Field>
          </div>
          <Field label="E-mail">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Téléphone (optionnel)">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              autoComplete="tel"
            />
          </Field>
          <Field label="Date de naissance (optionnel)">
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className={inputClass}
              autoComplete="bday"
            />
          </Field>
          <Field label="Code de parrainage (optionnel)">
            <input
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              className={inputClass}
              placeholder="Numéro de fidélité d'un ami"
            />
          </Field>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-2xl py-4 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
            style={{ background: "#171512", fontFamily: "var(--font-body)" }}
          >
            {submitting ? "Création en cours…" : "Créer ma carte"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ConfirmationView({
  company,
  result,
}: {
  company: CompanyPublicInfo;
  result: JoinResponse;
}) {
  const platform = detectWalletPlatform();

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-6">
        <ArchMark color={company.accentColor} size={56} />

        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {result.alreadyEnrolled ? "Vous avez déjà une carte" : "Votre carte est prête"}
          </h1>
          <p className="text-sm text-black/60 mt-2">
            {result.alreadyEnrolled
              ? `Nous avons retrouvé votre compte chez ${company.companyName}`
              : `Bienvenue chez ${company.companyName}`}
          </p>
        </div>

        <div className="w-full flex flex-col gap-3 mt-2">
          <a
            href={applePassDownloadUrl(result.walletToken)}
            className="rounded-2xl py-4 text-sm font-bold uppercase tracking-wider text-white text-center"
            style={{
              background: "#171512",
              opacity: platform === "google" ? 0.55 : 1,
            }}
          >
            Ajouter à Apple Wallet
          </a>
          <a
            href={googleWalletSaveUrl(result.walletToken)}
            className="rounded-2xl py-4 text-sm font-bold uppercase tracking-wider border text-center"
            style={{
              borderColor: "#17151233",
              opacity: platform === "apple" ? 0.55 : 1,
            }}
          >
            Ajouter à Google Wallet
          </a>
        </div>

        <p className="text-xs text-black/40 mt-2">
          Numéro de fidélité : {result.loyaltyNumber}
        </p>

        {result.referralApplied && (
          <p className="text-xs rounded-full px-3 py-1.5" style={{ background: `${company.accentColor}1a`, color: company.accentColor }}>
            Points de parrainage crédités 🎉
          </p>
        )}

        <Link
          to={`/ma-carte/${result.cardViewToken}`}
          className="text-xs font-semibold uppercase tracking-wide text-black/50 hover:text-black underline underline-offset-2 mt-2"
        >
          Voir ma fiche client
        </Link>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      <span className="text-xs font-semibold uppercase tracking-wide text-black/45">{label}</span>
      {children}
    </label>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center">
      <div>{children}</div>
    </div>
  );
}

const inputClass =
  "rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/30 transition-colors";
