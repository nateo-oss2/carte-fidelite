import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { companyMe, customerBarcodeUrl, getCustomerDetail, type CustomerDetail } from "../lib/companyApi";

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

  useEffect(() => {
    companyMe(slug)
      .then((me) => setRole(me.role))
      .catch(() => navigate(`/company/${slug}/login`))
      .finally(() => setChecking(false));
  }, [slug, navigate]);

  useEffect(() => {
    if (!checking) {
      getCustomerDetail(slug, customerId).then(setCustomer);
    }
  }, [checking, slug, customerId]);

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

  return (
    <div className="min-h-screen px-6 py-10 max-w-md mx-auto">
      <Link to={`/company/${slug}/customers`} className="text-xs text-black/40 hover:text-black/70">
        ← Retour aux clients
      </Link>

      <h1 className="text-lg font-bold uppercase tracking-widest mt-4 mb-1" style={{ fontFamily: "var(--font-display)" }}>
        {displayName}
      </h1>
      <p className="text-xs text-black/40 mb-6">
        N° client : {customer.loyaltyNumber}
        {!customer.hasActiveCard && " · carte révoquée"}
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <p className="text-xs text-black/45 mb-1">Solde actuel</p>
          <p className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {customer.pointsBalance} pts
          </p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <p className="text-xs text-black/45 mb-1">Cumul total</p>
          <p className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {customer.lifetimePoints} pts
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-5 mb-6 flex flex-col items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-black/45 self-start">Code-barres</p>
        {!customer.hasActiveCard ? (
          <p className="text-sm text-black/40 py-6">Ce client n'a plus de carte active.</p>
        ) : role !== "ADMIN" && role !== "MANAGER" ? (
          <p className="text-sm text-black/40 py-6">
            Visible uniquement par un administrateur ou un manager de l'entreprise.
          </p>
        ) : barcodeError ? (
          <p className="text-sm text-red-600 py-6">Impossible de charger le code-barres.</p>
        ) : barcodeSrc ? (
          <img src={barcodeSrc} alt="Code-barres du client" className="w-full max-w-[280px]" />
        ) : (
          <p className="text-sm text-black/40 py-6">Chargement…</p>
        )}
      </div>

      <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
        <p className="text-xs font-semibold uppercase tracking-wide text-black/45 px-5 pt-4 pb-2">
          Achats et points récents
        </p>
        {customer.recentTransactions.length === 0 ? (
          <p className="text-sm text-black/40 px-5 pb-5">Aucune transaction pour le moment.</p>
        ) : (
          <ul>
            {customer.recentTransactions.map((tx) => (
              <li key={tx.id} className="px-5 py-3 border-t border-black/5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {TYPE_LABELS[tx.type] ?? tx.type}
                    {tx.status === "REVERSED" && <span className="text-black/40"> (remboursé)</span>}
                  </p>
                  <p className="text-xs text-black/40">{new Date(tx.createdAt).toLocaleString("fr-FR")}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold">{tx.amount} €</p>
                  <p className={`text-xs ${tx.pointsDelta >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {tx.pointsDelta >= 0 ? "+" : ""}
                    {tx.pointsDelta} pts
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
