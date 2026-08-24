import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { companyLogout, companyMe, getCompanyDashboard, qrCodeUrl, type CompanyDashboardData } from "../lib/companyApi";

export function CompanyDashboardPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [data, setData] = useState<CompanyDashboardData | null>(null);

  useEffect(() => {
    companyMe(slug)
      .then((me) => setRole(me.role))
      .catch(() => navigate(`/company/${slug}/login`))
      .finally(() => setCheckingSession(false));
  }, [slug, navigate]);

  useEffect(() => {
    if (!checkingSession) {
      getCompanyDashboard(slug).then(setData);
    }
  }, [checkingSession, slug]);

  async function handleLogout() {
    await companyLogout(slug);
    navigate(`/company/${slug}/login`);
  }

  if (checkingSession || !data) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-black/40">Chargement…</div>;
  }

  const { company, stats } = data;

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          {company.logoUrl && (
            <img src={company.logoUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
          )}
          <h1 className="text-lg font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>
            {company.name}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link to={`/company/${slug}/customers`} className="text-xs text-black/50 hover:text-black">
            Clients
          </Link>
          <Link to={`/company/${slug}/program`} className="text-xs text-black/50 hover:text-black">
            Programme
          </Link>
          {role === "ADMIN" && (
            <Link to={`/company/${slug}/employees`} className="text-xs text-black/50 hover:text-black">
              Employés
            </Link>
          )}
          <button onClick={handleLogout} className="text-xs text-black/40 hover:text-black/70">
            Déconnexion
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatTile label="Clients" value={stats.customersCount} />
        <StatTile label="Nouveaux clients aujourd'hui" value={stats.newCustomersToday} />
        <StatTile label="Transactions" value={stats.transactionsCount} />
        <StatTile label="Transactions aujourd'hui" value={stats.transactionsToday} />
        <StatTile label="Points distribués" value={stats.pointsDistributed} />
        <StatTile label="Montant total encaissé" value={`${stats.totalAmount} €`} />
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-5 flex items-center gap-5 mb-6">
        <img src={qrCodeUrl(company.joinToken)} alt="QR code" className="w-24 h-24 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold mb-1">QR code d'inscription</p>
          <p className="text-xs text-black/50">
            Affichez-le en boutique — {company.pointsPerCurrencyUnit}€ dépensé = 1 point.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
        <p className="text-xs font-semibold uppercase tracking-wide text-black/45 px-5 pt-4 pb-2">
          Transactions récentes
        </p>
        {stats.recentTransactions.length === 0 ? (
          <p className="text-sm text-black/40 px-5 pb-5">Aucune transaction pour le moment.</p>
        ) : (
          <ul>
            {stats.recentTransactions.map((tx) => (
              <li key={tx.id} className="px-5 py-3 border-t border-black/5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{tx.customerName}</p>
                  <p className="text-xs text-black/40">{new Date(tx.createdAt).toLocaleString("fr-FR")}</p>
                </div>
                <div className="text-right">
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

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <p className="text-xs text-black/45 mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </p>
    </div>
  );
}
