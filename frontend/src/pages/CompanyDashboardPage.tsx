import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  companyLogout,
  companyMe,
  getCompanyDashboard,
  getTodaysBirthdays,
  qrCodeUrl,
  sendCustomerNotifications,
  type BirthdayCustomer,
  type CompanyDashboardData,
} from "../lib/companyApi";

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
          <Link to={`/company/${slug}/scan`} className="text-xs text-black/50 hover:text-black">
            Scan
          </Link>
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

      <BirthdayWidget slug={slug} companyName={company.name} />

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

function BirthdayWidget({ slug, companyName }: { slug: string; companyName: string }) {
  const [customers, setCustomers] = useState<BirthdayCustomer[] | null>(null);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    getTodaysBirthdays(slug).then((res) => setCustomers(res.customers));
  }, [slug]);

  async function handleSend(customer: BirthdayCustomer) {
    setSendingId(customer.id);
    try {
      await sendCustomerNotifications(slug, {
        customerIds: [customer.id],
        subject: `Joyeux anniversaire de la part de ${companyName} 🎉`,
        message: `Bonjour ${customer.firstName ?? ""},\n\nToute l'équipe de ${companyName} vous souhaite un très joyeux anniversaire !\n\nPour l'occasion, votre prochain achat en boutique de moins de 15€ vous est offert. Présentez simplement votre carte de fidélité en caisse.\n\nÀ très bientôt,\nL'équipe ${companyName}`,
      });
      setSentIds((prev) => [...prev, customer.id]);
    } finally {
      setSendingId(null);
    }
  }

  if (!customers || customers.length === 0) return null;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 mb-6">
      <p className="text-sm font-semibold mb-1">🎂 Anniversaires du jour</p>
      <p className="text-xs text-black/50 mb-4">
        Envoyez un message avec un cadeau (moins de 15€ offert en boutique).
      </p>
      <ul className="flex flex-col gap-2">
        {customers.map((customer) => {
          const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.loyaltyNumber;
          const sent = sentIds.includes(customer.id);
          return (
            <li key={customer.id} className="flex items-center justify-between gap-3">
              <span className="text-sm">{name}</span>
              <button
                type="button"
                onClick={() => handleSend(customer)}
                disabled={sent || sendingId === customer.id}
                className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-lg ${
                  sent ? "text-green-700" : "text-black/70 border border-black/10 hover:border-black/30"
                } disabled:opacity-60`}
              >
                {sent ? "Envoyé ✓" : sendingId === customer.id ? "Envoi…" : "Envoyer le message"}
              </button>
            </li>
          );
        })}
      </ul>
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
