"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

type FailureRow = {
  id: number;
  ipAddress: string;
  identifier: string;
  type: string;
  createdAt: string;
};

type ByAccountRow = {
  identifier: string;
  count: number;
  lastAt: string | null;
  isUserId: boolean;
  userName?: string | null;
  userEmail?: string | null;
};

type ByIpRow = {
  ipAddress: string;
  count: number;
  lastAt: string | null;
};

type UserWithLock = {
  id: number;
  email: string;
  name: string;
  lockedUntil: string;
};

type Report = {
  days: number;
  since: string;
  recent: FailureRow[];
  byAccount: ByAccountRow[];
  byIp: ByIpRow[];
  usersWithLock: UserWithLock[];
};

function formatDate(s: string | null): string {
  if (!s) return "–";
  try {
    return format(new Date(s), "dd.MM.yyyy HH:mm", { locale: de });
  } catch {
    return s;
  }
}

export function SecurityReportClient() {
  const [days, setDays] = useState(7);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState<number | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/security/report?days=${days}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Report konnte nicht geladen werden.");
      }
      const data = await res.json();
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleClearLock = useCallback(async (userId: number) => {
    setClearing(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/clear-lock`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Entsperren fehlgeschlagen.");
      await fetchReport();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setClearing(null);
    }
  }, [fetchReport]);

  if (loading && !report) {
    return (
      <section className="rounded-xl border border-ring bg-panel p-6">
        <h2 className="text-lg font-semibold text-text">Security-Report</h2>
        <p className="mt-1 text-sm text-text/60">Lade Daten …</p>
        <div className="mt-5 flex items-center gap-3 text-text/70">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-ring border-t-accent" aria-hidden />
          <span className="text-sm">Report wird geladen …</span>
        </div>
      </section>
    );
  }

  if (error && !report) {
    return (
      <section className="rounded-xl border border-ring bg-panel p-6">
        <h2 className="text-lg font-semibold text-text">Security-Report</h2>
        <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      </section>
    );
  }

  const r = report!;
  const totalFailures = r.byAccount.reduce((a, x) => a + x.count, 0);

  return (
    <div className="space-y-8">
      {/* Toolbar + Schnellüberblick */}
      <section className="rounded-xl border border-ring bg-panel p-6">
        <h2 className="text-lg font-semibold text-text">Zeitraum &amp; Schnellüberblick</h2>
        <p className="mt-1 text-sm text-text/60">
          Zeitraum wählen und Report aktualisieren. Übersicht über Sperren und Fehlversuche.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-text/80">
            Zeitraum:
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-lg border border-ring bg-bg px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value={7}>7 Tage</option>
              <option value={14}>14 Tage</option>
              <option value={30}>30 Tage</option>
            </select>
          </label>
          <span className="text-sm text-text/60">seit {formatDate(r.since)}</span>
          <button
            type="button"
            onClick={() => fetchReport()}
            className="rounded-lg border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20"
          >
            Aktualisieren
          </button>
        </div>
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-ring bg-bg/30 p-5">
            <p className="text-sm font-medium text-text/60">Temporär gesperrte Nutzer</p>
            <p className="mt-1 text-2xl font-bold text-text">{r.usersWithLock.length}</p>
          </div>
          <div className="rounded-xl border border-ring bg-bg/30 p-5">
            <p className="text-sm font-medium text-text/60">Fehlversuche (Zeitraum)</p>
            <p className="mt-1 text-2xl font-bold text-text">{totalFailures}</p>
          </div>
          <div className="rounded-xl border border-ring bg-bg/30 p-5">
            <p className="text-sm font-medium text-text/60">Betroffene Accounts</p>
            <p className="mt-1 text-2xl font-bold text-text">{r.byAccount.length}</p>
          </div>
          <div className="rounded-xl border border-ring bg-bg/30 p-5">
            <p className="text-sm font-medium text-text/60">Betroffene IPs</p>
            <p className="mt-1 text-2xl font-bold text-text">{r.byIp.length}</p>
          </div>
        </div>
      </section>

      {/* Temporär gesperrte Nutzer */}
      <section className="rounded-xl border border-ring bg-panel p-6">
        <h2 className="text-lg font-semibold text-text">Temporär gesperrte Nutzer</h2>
        <p className="mt-1 text-sm text-text/60">
          Brute-Force-Erkennung: Nutzer mit Sperre können hier entsperrt werden.
        </p>
        {r.usersWithLock.length === 0 ? (
          <p className="mt-5 text-sm text-text/60">Keine temporären Sperren.</p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-xl border border-ring bg-bg/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ring/60 text-left">
                  <th className="p-3 font-medium text-text/80">Name</th>
                  <th className="p-3 font-medium text-text/80">E-Mail</th>
                  <th className="p-3 font-medium text-text/80">Gesperrt bis</th>
                  <th className="p-3 font-medium text-text/80">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {r.usersWithLock.map((u) => (
                  <tr key={u.id} className="border-b border-ring/40 last:border-0">
                    <td className="p-3 text-text">{u.name}</td>
                    <td className="p-3 text-text/90">{u.email}</td>
                    <td className="p-3 text-text/80">{formatDate(u.lockedUntil)}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => handleClearLock(u.id)}
                        disabled={clearing === u.id}
                        className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {clearing === u.id ? "…" : "Entsperren"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pro Account */}
      <section className="rounded-xl border border-ring bg-panel p-6">
        <h2 className="text-lg font-semibold text-text">Fehlversuche pro Account</h2>
        <p className="mt-1 text-sm text-text/60">
          E-Mail oder User – Anzahl und letzter Fehlversuch.
        </p>
        {r.byAccount.length === 0 ? (
          <p className="mt-5 text-sm text-text/60">Keine Fehlversuche in diesem Zeitraum.</p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-xl border border-ring bg-bg/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ring/60 text-left">
                  <th className="p-3 font-medium text-text/80">Account</th>
                  <th className="p-3 font-medium text-text/80">Anzahl</th>
                  <th className="p-3 font-medium text-text/80">Letzter Versuch</th>
                </tr>
              </thead>
              <tbody>
                {r.byAccount.map((row, i) => (
                  <tr key={`${row.identifier}-${i}`} className="border-b border-ring/40 last:border-0">
                    <td className="p-3 text-text">
                      {row.isUserId ? (
                        row.userEmail != null ? (
                          <span>{row.userName ?? row.identifier} ({row.userEmail})</span>
                        ) : (
                          <span className="text-text/80">User #{row.identifier.replace("user:", "")}</span>
                        )
                      ) : (
                        row.identifier
                      )}
                    </td>
                    <td className="p-3 text-text/90">{row.count}</td>
                    <td className="p-3 text-text/80">{formatDate(row.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pro IP */}
      <section className="rounded-xl border border-ring bg-panel p-6">
        <h2 className="text-lg font-semibold text-text">Fehlversuche pro IP</h2>
        <p className="mt-1 text-sm text-text/60">
          IP-Adressen mit Fehlversuchen im gewählten Zeitraum.
        </p>
        {r.byIp.length === 0 ? (
          <p className="mt-5 text-sm text-text/60">Keine Fehlversuche in diesem Zeitraum.</p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-xl border border-ring bg-bg/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ring/60 text-left">
                  <th className="p-3 font-medium text-text/80">IP</th>
                  <th className="p-3 font-medium text-text/80">Anzahl</th>
                  <th className="p-3 font-medium text-text/80">Letzter Versuch</th>
                </tr>
              </thead>
              <tbody>
                {r.byIp.map((row, i) => (
                  <tr key={`${row.ipAddress}-${i}`} className="border-b border-ring/40 last:border-0">
                    <td className="p-3 text-text font-mono">{row.ipAddress}</td>
                    <td className="p-3 text-text/90">{row.count}</td>
                    <td className="p-3 text-text/80">{formatDate(row.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Letzte Fehlversuche */}
      <section className="rounded-xl border border-ring bg-panel p-6">
        <h2 className="text-lg font-semibold text-text">Letzte Fehlversuche</h2>
        <p className="mt-1 text-sm text-text/60">
          Chronologische Liste (max. 200 Einträge) – Login und 2FA.
        </p>
        {r.recent.length === 0 ? (
          <p className="mt-5 text-sm text-text/60">Keine Einträge.</p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-xl border border-ring bg-bg/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ring/60 text-left">
                  <th className="p-3 font-medium text-text/80">Zeit</th>
                  <th className="p-3 font-medium text-text/80">IP</th>
                  <th className="p-3 font-medium text-text/80">Account</th>
                  <th className="p-3 font-medium text-text/80">Typ</th>
                </tr>
              </thead>
              <tbody>
                {r.recent.map((row) => (
                  <tr key={row.id} className="border-b border-ring/40 last:border-0">
                    <td className="p-3 text-text/80">{formatDate(row.createdAt)}</td>
                    <td className="p-3 font-mono text-text/90">{row.ipAddress}</td>
                    <td className="p-3 text-text/90">
                      {row.identifier.startsWith("user:")
                        ? `User #${row.identifier.replace("user:", "")}`
                        : row.identifier}
                    </td>
                    <td className="p-3 text-text/80">
                      {row.type === "TWO_FA" ? "2FA" : "Login"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
