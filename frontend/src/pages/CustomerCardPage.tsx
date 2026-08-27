import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError, fetchCustomerCard, type CustomerCardInfo } from "../lib/api";
import { ArchMark } from "../components/ArchMark";

type LoadState = { status: "loading" } | { status: "not-found" } | { status: "ready"; card: CustomerCardInfo };

/** Fiche client en lecture seule, accessible au client lui-même via le lien reçu après inscription. */
export function CustomerCardPage() {
  const { token = "" } = useParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchCustomerCard(token)
      .then((card) => {
        if (!cancelled) setState({ status: "ready", card });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setState({ status: "not-found" });
        } else {
          setState({ status: "not-found" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-sm text-black/40">Chargement…</div>;
  }

  if (state.status === "not-found") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <p className="text-sm text-black/50">Carte introuvable ou lien invalide.</p>
      </div>
    );
  }

  const { card } = state;
  const displayName = [card.firstName, card.lastName].filter(Boolean).join(" ") || card.loyaltyNumber;
  const initials = [card.firstName?.[0], card.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-6">
        {card.companyLogoUrl ? (
          <img src={card.companyLogoUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <ArchMark color={card.companyAccentColor} size={48} />
        )}
        <p className="text-xs font-semibold uppercase tracking-widest text-black/45">{card.companyName}</p>

        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-white"
          style={{ fontFamily: "var(--font-display)", background: "linear-gradient(150deg, #171512, #3a352c)" }}
        >
          {initials}
        </div>

        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {displayName}
        </h1>

        <div className="w-full rounded-2xl border border-black/10 bg-white px-5 py-4 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-black/40">Numéro de fidélité</p>
          <p className="text-sm font-mono tracking-wider text-black/85">{card.loyaltyNumber}</p>
        </div>

        <div className="w-full rounded-2xl border border-black/10 bg-white p-6">
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-4xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {card.pointsBalance}
            </span>
            <span className="text-xs text-black/45">points disponibles</span>
          </div>
          <p className="text-xs text-black/35 font-mono mt-2">{card.lifetimePoints} pts cumulés au total</p>
        </div>

        <p className="text-xs text-black/40">
          Présentez votre carte Wallet en caisse pour cumuler des points à chaque achat.
        </p>
      </div>
    </div>
  );
}
