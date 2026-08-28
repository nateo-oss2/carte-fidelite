import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { customerCardBarcodeUrl, fetchCustomerCard, type CustomerCardInfo } from "../lib/api";
import { WalletCardPreview } from "../components/WalletCardPreview";

type LoadState = { status: "loading" } | { status: "not-found" } | { status: "ready"; card: CustomerCardInfo };

/** Fiche client en lecture seule, accessible au client lui-même via le lien reçu après inscription. */
export function CustomerCardPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [rotatedLink, setRotatedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Toujours le token actuellement valide (celui de l'URL, ou le nouveau après rotation) —
  // c'est celui-là qu'il faut utiliser pour charger l'image du code-barres.
  const [activeToken, setActiveToken] = useState(token);
  // Le lien tourne une seule fois côté serveur : un double appel (React StrictMode en dev,
  // double-clic, prefetch navigateur) sur le même token ferait échouer le second. On garde une
  // trace du token déjà consommé pour ne jamais rejouer l'appel réseau pour cette même valeur.
  const consumedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Garde anti-double-appel unique (pas de flag "cancelled" en plus : un lien à usage unique
    // ne doit jamais laisser une réponse réelle se faire jeter par un remontage React en dev).
    if (consumedTokenRef.current === token) return;
    consumedTokenRef.current = token;

    fetchCustomerCard(token)
      .then((card) => {
        setState({ status: "ready", card });
        if (card.newToken) {
          // Le lien qui vient de servir ne fonctionnera plus — on bascule discrètement l'URL du
          // navigateur vers le nouveau, pour qu'un rafraîchissement ou un favori créé maintenant
          // continue de marcher, et on l'affiche pour que le client puisse le sauvegarder ailleurs.
          const newUrl = `/ma-carte/${card.newToken}`;
          navigate(newUrl, { replace: true });
          setRotatedLink(`${window.location.origin}${newUrl}`);
          setActiveToken(card.newToken);
        }
      })
      .catch(() => {
        setState({ status: "not-found" });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function handleCopy() {
    if (!rotatedLink) return;
    navigator.clipboard.writeText(rotatedLink).then(() => setCopied(true));
  }

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
        <WalletCardPreview
          companyName={card.companyName}
          accentColor={card.companyAccentColor}
          secondaryColor={card.companySecondaryColor}
          cardTemplate={card.companyCardTemplate}
          logoUrl={card.companyLogoUrl}
        />

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
          {(card.pointsExpiryEnabled || card.offPeakBonus.enabled) && (
            <div className="mt-3 pt-3 border-t border-black/5 flex flex-col gap-1.5">
              {card.offPeakBonus.enabled && (
                <p className="text-xs text-black/40">
                  Vos points sont doublés entre {card.offPeakBonus.startHour}h et {card.offPeakBonus.endHour}h.
                </p>
              )}
              {card.pointsExpiryEnabled && (
                <p className="text-xs text-black/40">
                  Vos points expirent après {card.pointsExpiryMonths} mois sans achat ni dépense.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="w-full rounded-2xl border border-black/10 bg-white p-5 flex flex-col items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-black/40 self-start">
            Code-barres
          </p>
          <img src={customerCardBarcodeUrl(activeToken)} alt="Code-barres de ma carte" className="w-full max-w-[260px]" />
          <p className="text-xs font-mono tracking-widest text-black/50">{card.loyaltyNumber}</p>
        </div>

        {card.programType === "DISCOUNT" ? (
          <div className="w-full rounded-2xl border border-black/10 bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-black/40 mb-2">
              Réduction actuelle
            </p>
            <p className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
              {card.currentDiscountPercent ? `${Number(card.currentDiscountPercent)}%` : "Aucune"}
            </p>
          </div>
        ) : (
          card.availableRewards.length > 0 && (
            <div className="w-full rounded-2xl border border-black/10 bg-white overflow-hidden text-left">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-black/40 px-5 pt-4 pb-2">
                Récompenses disponibles
              </p>
              <ul>
                {card.availableRewards.map((reward) => (
                  <li key={reward.id} className="px-5 py-3 border-t border-black/5 flex items-center justify-between">
                    <span className="text-sm font-medium">{reward.name}</span>
                    <span className="text-xs text-black/40 font-mono">{reward.pointsCost} pts</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}

        {rotatedLink && (
          <div className="w-full rounded-2xl border border-black/10 bg-black/[0.03] p-4 flex flex-col gap-2 text-left">
            <p className="text-xs font-semibold text-black/70">
              Ce lien a été mis à jour pour votre sécurité — enregistrez celui-ci pour revenir facilement :
            </p>
            <code className="text-xs break-all text-black/60">{rotatedLink}</code>
            <button
              type="button"
              onClick={handleCopy}
              className="self-start text-xs font-semibold uppercase tracking-wide text-black/70 border border-black/10 rounded-lg px-3 py-1.5 hover:border-black/30"
            >
              {copied ? "Copié !" : "Copier le lien"}
            </button>
          </div>
        )}

        <p className="text-xs text-black/40">
          Présentez votre carte Wallet en caisse pour cumuler des points à chaque achat.
        </p>
      </div>
    </div>
  );
}
