import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminMe, listAuditLogs, type AuditLogEntry } from "../lib/adminApi";

export function AdminAuditLogsPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminMe()
      .then(() => setChecking(false))
      .catch(() => navigate("/admin/login"));
  }, [navigate]);

  useEffect(() => {
    if (!checking) {
      listAuditLogs()
        .then((res) => setLogs(res.logs))
        .finally(() => setLoading(false));
    }
  }, [checking]);

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-black/40">Chargement…</div>;
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <Link to="/admin" className="text-xs text-black/40 hover:text-black/70">
        ← Retour aux entreprises
      </Link>

      <h1 className="text-lg font-bold uppercase tracking-widest mt-4 mb-6" style={{ fontFamily: "var(--font-display)" }}>
        Journal d'audit
      </h1>

      {loading ? (
        <p className="text-sm text-black/40">Chargement…</p>
      ) : (
        <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
          <ul>
            {logs.map((log) => (
              <li key={log.id} className="px-5 py-3 border-b border-black/5 last:border-b-0 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{log.action}</p>
                  <p className="text-xs text-black/40 truncate">
                    {log.companyName ?? "—"} · {log.actorLabel ?? log.actorType}
                  </p>
                </div>
                <p className="text-xs text-black/40 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("fr-FR")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
