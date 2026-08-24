import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  companyMe,
  listCustomers,
  revokeCustomerCard,
  sendCustomerNotifications,
  type Customer,
} from "../lib/companyApi";

function daysSince(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const diffMs = Date.now() - new Date(dateIso).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function lastPurchaseLabel(dateIso: string | null): string {
  const days = daysSince(dateIso);
  if (days === null) return "Jamais acheté";
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Il y a 1 jour";
  return `Il y a ${days} jours`;
}

const TEMPLATES = [
  {
    label: "Relance",
    subject: "On ne vous a pas vu depuis un moment !",
    message:
      "Bonjour,\n\nÇa fait un moment que nous ne vous avons pas vu. Nous serions ravis de vous accueillir à nouveau bientôt !\n\nÀ bientôt,",
  },
  {
    label: "Promotion",
    subject: "Une offre spéciale rien que pour vous",
    message:
      "Bonjour,\n\nNous avons une offre spéciale à vous proposer en tant que membre fidèle de notre programme. Passez nous voir !\n\nÀ bientôt,",
  },
];

export function CompanyCustomersPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState(false);

  const refresh = useCallback(
    (query?: string) => {
      setLoading(true);
      listCustomers(slug, query)
        .then((res) => setCustomers(res.customers))
        .finally(() => setLoading(false));
    },
    [slug],
  );

  useEffect(() => {
    companyMe(slug)
      .then((me) => setRole(me.role))
      .catch(() => navigate(`/company/${slug}/login`))
      .finally(() => setChecking(false));
  }, [slug, navigate]);

  useEffect(() => {
    if (!checking) refresh();
  }, [checking, refresh]);

  useEffect(() => {
    const timeout = setTimeout(() => refresh(search || undefined), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleRevoke(customerId: string) {
    setRevokingId(customerId);
    try {
      await revokeCustomerCard(slug, customerId);
      refresh(search || undefined);
    } finally {
      setRevokingId(null);
    }
  }

  function toggleSelected(customerId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  }

  const canRevoke = role === "ADMIN" || role === "MANAGER";

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-black/40">Chargement…</div>;
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-md mx-auto pb-28">
      <Link to={`/company/${slug}`} className="text-xs text-black/40 hover:text-black/70">
        ← Retour au dashboard
      </Link>

      <h1 className="text-lg font-bold uppercase tracking-widest mt-4 mb-6" style={{ fontFamily: "var(--font-display)" }}>
        Clients
      </h1>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un nom ou un numéro de fidélité…"
        className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/30 mb-6"
      />

      {loading ? (
        <p className="text-sm text-black/40">Chargement…</p>
      ) : customers.length === 0 ? (
        <p className="text-sm text-black/40">Aucun client trouvé.</p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-xs text-black/50 mb-3">
            <input
              type="checkbox"
              checked={customers.filter((c) => c.email).every((c) => selected.has(c.id))}
              onChange={(e) => {
                const emailable = customers.filter((c) => c.email).map((c) => c.id);
                setSelected(e.target.checked ? new Set(emailable) : new Set());
              }}
            />
            Tout sélectionner ({customers.filter((c) => c.email).length} client
            {customers.filter((c) => c.email).length === 1 ? "" : "s"} avec e-mail)
          </label>
          <ul className="flex flex-col gap-3">
          {customers.map((customer) => {
            const days = daysSince(customer.lastPurchaseAt);
            const isStale = days !== null && days >= 30;
            return (
              <li key={customer.id} className="rounded-2xl border border-black/10 bg-white p-4 flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(customer.id)}
                  onChange={() => toggleSelected(customer.id)}
                  disabled={!customer.email}
                  title={!customer.email ? "Pas d'e-mail renseigné" : undefined}
                  className="mt-1"
                />
                <Link to={`/company/${slug}/customers/${customer.id}`} className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {[customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.loyaltyNumber}
                  </p>
                  <p className="text-xs text-black/40">
                    {customer.loyaltyNumber} · {customer.pointsBalance} pts
                    {!customer.hasActiveCard && " · carte révoquée"}
                  </p>
                  <p className={`text-xs mt-0.5 ${isStale ? "text-amber-700 font-medium" : "text-black/40"}`}>
                    {customer.purchaseCount} achat{customer.purchaseCount === 1 ? "" : "s"} · {lastPurchaseLabel(customer.lastPurchaseAt)}
                  </p>
                </Link>
                {canRevoke && customer.hasActiveCard && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(customer.id)}
                    disabled={revokingId === customer.id}
                    className="text-xs font-semibold uppercase tracking-wide text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg disabled:opacity-50 flex-shrink-0"
                  >
                    {revokingId === customer.id ? "…" : "Révoquer"}
                  </button>
                )}
              </li>
            );
          })}
          </ul>
        </>
      )}

      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 flex justify-center px-6 pb-6">
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="rounded-2xl py-3.5 px-6 text-sm font-bold uppercase tracking-wider text-white shadow-lg"
            style={{ background: "#171512" }}
          >
            Envoyer une notification ({selected.size})
          </button>
        </div>
      )}

      {composing && (
        <ComposeModal
          slug={slug}
          customerIds={[...selected]}
          onClose={() => setComposing(false)}
          onSent={() => {
            setComposing(false);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}

function ComposeModal({
  slug,
  customerIds,
  onClose,
  onSent,
}: {
  slug: string;
  customerIds: string[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  function applyTemplate(template: (typeof TEMPLATES)[number]) {
    setSubject(template.subject);
    setMessage(template.message);
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const { results } = await sendCustomerNotifications(slug, {
        customerIds,
        subject: subject.trim(),
        message: message.trim(),
      });
      const okCount = results.filter((r) => r.ok).length;
      if (okCount === results.length) {
        onSent();
      } else {
        setSummary(`${okCount}/${results.length} e-mails envoyés. Certains ont échoué (voir le journal d'audit).`);
      }
    } catch {
      setError("L'envoi a échoué. Vérifiez qu'un fournisseur e-mail est configuré sur le serveur.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
        <p className="text-sm font-semibold">
          Notification à {customerIds.length} client{customerIds.length === 1 ? "" : "s"}
        </p>

        <div className="flex gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => applyTemplate(t)}
              className="text-xs font-semibold uppercase tracking-wide text-black/60 border border-black/10 rounded-lg px-3 py-1.5 hover:border-black/30"
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Objet</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/30"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/45">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/30 resize-none"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {summary && <p className="text-sm text-amber-700">{summary}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !subject.trim() || !message.trim()}
            className="rounded-xl py-3 px-5 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-60"
            style={{ background: "#171512" }}
          >
            {sending ? "Envoi…" : "Envoyer"}
          </button>
          <button type="button" onClick={onClose} className="text-sm text-black/50 hover:text-black">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
