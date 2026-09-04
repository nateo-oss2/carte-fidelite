import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  companyMe,
  customerBarcodeUrl,
  getCustomerDetail,
  redeemCustomerReward,
  type CustomerDetail,
} from "../lib/companyApi";
import { WalletCardPreview } from "../components/WalletCardPreview";

const TYPE_LABELS: Record<string, string> = {
  PURCHASE: "Achat",
  REFUND: "Remboursement",
  REDEMPTION: "Récompense échangée",
  ADJUSTMENT: "Ajustement",
};

export function CustomerDetailPage() {
  const { slug = "", customerId = "" } = useParams();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [barcodeSrc, setBarcodeSrc] = useState<string | null>(null);
  const [barcodeError, setBarcodeError] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  useEffect(() => {
    companyMe(slug)
      .then((me) => setRole(me.role))
      .catch(() => navigate(`/company/${slug}/login`))
      .finally(() => setChecking(false));
  }, [slug, navigate]);

  const refreshCustomer = useCallback(() => {
    getCustomerDetail(slug, customerId).then(setCustomer);
  }, [slug, customerId]);

  useEffect(() => {
    if (!checking) refreshCustomer();
  }, [checking, refreshCustomer]);

  async function handleRedeem(rewardId: string) {
    setRedeemingId(rewardId);
    setRedeemError(null);
    try {
      await redeemCustomerReward(slug, customerId, rewardId);
      refreshCustomer();
    } catch {
      setRedeemError("Impossible d'échanger cette récompense.");
    } finally {
      setRedeemingId(null);
    }
  }

  useEffect(() => {
    if (checking || !customer || !(role === "ADMIN" || role === "MANAGER") || !customer.hasActiveCard) return;

    let objectUrl: string | null = null;
    fetch(customerBarcodeUrl(slug, customerId), { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("barcode fetch failed");
        return res.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setBarcodeSrc(objectUrl);
      })
      .catch(() => setBarcodeError(true));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [checking, customer, role, slug, customerId]);

  if (checking || !customer) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-black/40">Chargement…</div>;
  }

  const displayName = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.loyaltyNumber;
  const initials =
    [customer.firstName?.[0], customer.lastName?.[0]].filter(Boolean).join("").toUpperCase() ||
    customer.loyaltyNumber.slice(0, 2);
  const memberSince = new Date(customer.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen px-6 py-10 max-w-md mx-auto">
      <Link to={`/company/${slug}/customers`} className="text-xs text-black/40 hover:text-black/70">
        ← Retour aux clients
      </Link>

      <div className="flex items-center gap-4 mt-5 mb-7">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-base font-bold text-white flex-shrink-0"
          style={{ fontFamily: "var(--font-display)", background: "linear-gradient(150deg, #171512, #3a352c)" }}
        >
          {initials}
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            {displayName}
          </h1>
          <p className="text-xs text-black/40 mt-0.5">
            Client·e depuis le {memberSince}
            {!customer.hasActiveCard && " · carte révoquée"}
          </p>
          {customer.email && <p className="text-xs text-black/40 mt-0.5">{customer.email}</p>}
        </div>
      </div>

      <div className="mb-6">
        <WalletCardPreview
          companyName={customer.companyName}
          accentColor={customer.companyAccentColor}
          logoUrl={customer.companyLogoUrl}
        />
      </div>

      <div className="rounded-2xl border border-black/10 bg-white px-5 py-4 mb-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-black/40">Numéro de fidélité</p>
        <p className="text-sm font-mono tracking-wider text-black/85">{customer.loyaltyNumber}</p>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-5 mb-6">
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-4xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            {customer.pointsBalance}
          </span>
          <span className="text-xs text-black/45">points disponibles</span>
        </div>
        <div className="flex items-center gap-2 pt-3 border-t border-black/5">
          <span className="text-[11px] uppercase tracking-widest text-black/40">Cumul total</span>
          <span className="text-xs font-mono text-black/60 ml-auto">{customer.lifetimePoints} pts</span>
        </div>
        {customer.offPeakBonus.enabled && (
          <p className="text-xs text-black/40 pt-3 mt-3 border-t border-black/5">
            Points doublés entre {customer.offPeakBonus.startHour}h et {customer.offPeakBonus.endHour}h.
          </p>
        )}
      </div>

      {customer.programType === "DISCOUNT" ? (
        <div className="rounded-2xl border border-black/10 bg-white p-5 mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-black/40 mb-2">
            Réduction actuelle
          </p>
          <p className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
            {customer.currentDiscountPercent ? `${Number(customer.currentDiscountPercent)}%` : "Aucune"}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-black/10 bg-white overflow-hidden mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-black/40 px-5 pt-4 pb-2">
            Récompenses disponibles
          </p>
          {customer.availableRewards.length === 0 ? (
            <p className="text-sm text-black/40 px-5 pb-5">
              Pas encore assez de points pour une récompense.
            </p>
          ) : (
            <ul>
              {customer.availableRewards.map((reward) => (
                <li key={reward.id} className="px-5 py-3 border-t border-black/5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{reward.name}</p>
                    <p className="text-xs text-black/40 font-mono">{reward.pointsCost} pts</p>
                  </div>
                  <button
                    type="button"
                    disabled={redeemingId === reward.id}
                    onClick={() => handleRedeem(reward.id)}
                    className="text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-lg text-black/70 border border-black/10 hover:border-black/30 disabled:opacity-50 flex-shrink-0"
                  >
                    {redeemingId === reward.id ? "…" : "Échanger"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {redeemError && <p className="text-sm text-red-600 px-5 pb-4">{redeemError}</p>}
        </div>
      )}

      <div className="rounded-2xl border border-black/10 bg-white p-5 mb-6 flex flex-col items-center gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-black/40 self-start">
          Code-barres — Code 128
        </p>
        {!customer.hasActiveCard ? (
          <p className="text-sm text-black/40 py-6">Ce client n'a plus de carte active.</p>
        ) : role !== "ADMIN" && role !== "MANAGER" ? (
          <p className="text-sm text-black/40 py-6">
            Visible uniquement par un administrateur ou un manager de l'entreprise.
          </p>
        ) : barcodeError ? (
          <p className="text-sm text-red-600 py-6">Impossible de charger le code-barres.</p>
        ) : barcodeSrc ? (
          <>
            <img src={barcodeSrc} alt="Code-barres du client" className="w-full max-w-[280px]" />
            <p className="text-xs font-mono tracking-widest text-black/50">{customer.loyaltyNumber}</p>
          </>
        ) : (
          <p className="text-sm text-black/40 py-6">Chargement…</p>
        )}
      </div>

      <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-black/40 px-5 pt-4 pb-2">
          Achats et points récents
        </p>
        {customer.recentTransactions.length === 0 ? (
          <p className="text-sm text-black/40 px-5 pb-5">Aucune transaction pour le moment.</p>
        ) : (
          <ul>
            {customer.recentTransactions.map((tx) => {
              const isPositive = tx.pointsDelta >= 0;
              return (
                <li key={tx.id} className="px-5 py-3 border-t border-black/5 flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
                      isPositive ? "bg-green-700/10 text-green-700" : "bg-red-600/10 text-red-600"
                    }`}
                  >
                    {isPositive ? "+" : "–"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {TYPE_LABELS[tx.type] ?? tx.type}
                      {tx.status === "REVERSED" && <span className="text-black/40"> (remboursé)</span>}
                    </p>
                    <p className="text-xs text-black/40 font-mono">{new Date(tx.createdAt).toLocaleString("fr-FR")}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold">{tx.amount} €</p>
                    <p className={`text-xs font-mono ${isPositive ? "text-green-700" : "text-red-600"}`}>
                      {isPositive ? "+" : ""}
                      {tx.pointsDelta} pts
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
