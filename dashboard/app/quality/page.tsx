"use client";

import { useEffect, useState } from "react";
import DataSourceBadge from "@/components/DataSourceBadge";

interface QualityData {
  generated_at: string;
  tables: {
    schema: string;
    table: string;
    row_count: number;
    column_count: number | null;
    layer: string;
  }[];
  freshness: {
    table: string;
    last_updated: string;
    sla_hours: number;
  }[];
  tests: {
    total: number;
    passed: number;
    failed: number;
    warned: number;
    results: {
      test_name: string;
      status: string;
      execution_time: number;
      message: string;
    }[];
  };
  summary: {
    total_tables: number;
    bronze_tables: number;
    silver_tables: number;
    gold_tables: number;
    total_rows: number;
  };
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pass: "bg-green-500/20 text-green-400",
    fail: "bg-red-500/20 text-red-400",
    warn: "bg-yellow-500/20 text-yellow-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${colors[status] || "bg-gray-700 text-gray-400"}`}>
      {status}
    </span>
  );
}

function FreshnessIndicator({ lastUpdated, slaHours }: { lastUpdated: string; slaHours: number }) {
  const updated = new Date(lastUpdated);
  const hoursAgo = (Date.now() - updated.getTime()) / (1000 * 60 * 60);
  const withinSla = hoursAgo <= slaHours;

  return (
    <div className={`flex items-center gap-2 ${withinSla ? "text-green-400" : "text-yellow-400"}`}>
      <span className={`w-2 h-2 rounded-full ${withinSla ? "bg-green-400" : "bg-yellow-400 animate-pulse"}`} />
      <span className="text-sm">
        {hoursAgo < 1 ? `${Math.round(hoursAgo * 60)}m ago` : `${hoursAgo.toFixed(1)}h ago`}
      </span>
      {!withinSla && <span className="text-xs text-yellow-500">(SLA: {slaHours}h)</span>}
    </div>
  );
}

export default function QualityPage() {
  const [data, setData] = useState<QualityData | null>(null);

  useEffect(() => {
    fetch("/data/quality.json").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <div className="text-gray-400">Loading quality data...</div>;

  const passRate = data.tests.total > 0 ? ((data.tests.passed / data.tests.total) * 100).toFixed(0) : "N/A";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🛡️</span>
        <div>
          <h1 className="text-2xl font-bold text-white">Data Quality</h1>
          <p className="text-gray-400 text-sm">
            Pipeline health · Test coverage · Data freshness
          </p>
        </div>
        <DataSourceBadge
          pattern="Data Observability"
          source="37 dbt tests + schema contracts + freshness SLAs"
          explanation="Monitors pipeline health: dbt tests (unique, not_null, accepted_values), source freshness SLAs (1h warn / 4h error on live tables), schema contracts (pre-ingestion validation via contracts.py), and table inventory tracking. Catches data quality issues before they reach the dashboard."
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-[#00ff85]">{passRate}%</p>
          <p className="text-xs text-gray-400 mt-1">Test Pass Rate</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-white">{data.tests.total}</p>
          <p className="text-xs text-gray-400 mt-1">Data Tests</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-white">{data.summary.total_tables}</p>
          <p className="text-xs text-gray-400 mt-1">Tables & Views</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-white">{data.summary.total_rows.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Total Rows</p>
        </div>
      </div>

      {/* Medallion Architecture */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { layer: "Bronze", count: data.summary.bronze_tables, color: "text-amber-600", icon: "🥉" },
          { layer: "Silver", count: data.summary.silver_tables, color: "text-gray-300", icon: "🥈" },
          { layer: "Gold", count: data.summary.gold_tables, color: "text-yellow-400", icon: "🥇" },
        ].map((l) => (
          <div key={l.layer} className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span>{l.icon}</span>
              <h3 className={`font-bold ${l.color}`}>{l.layer}</h3>
            </div>
            <p className="text-2xl font-black text-white">{l.count}</p>
            <p className="text-xs text-gray-400">tables</p>
          </div>
        ))}
      </div>

      {/* Freshness */}
      {data.freshness.length > 0 && (
        <div className="glass rounded-xl mb-6 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <h2 className="text-sm text-gray-400 uppercase tracking-wider">Data Freshness</h2>
          </div>
          <div className="divide-y divide-white/5">
            {data.freshness.map((f) => (
              <div key={f.table} className="px-4 py-3 flex items-center justify-between">
                <span className="text-white text-sm font-mono">{f.table}</span>
                <FreshnessIndicator lastUpdated={f.last_updated} slaHours={f.sla_hours} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Results */}
      <div className="glass rounded-xl mb-6 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm text-gray-400 uppercase tracking-wider">dbt Test Results</h2>
          <div className="flex gap-3 text-xs">
            <span className="text-green-400">✅ {data.tests.passed} passed</span>
            {data.tests.failed > 0 && <span className="text-red-400">❌ {data.tests.failed} failed</span>}
            {data.tests.warned > 0 && <span className="text-yellow-400">⚠️ {data.tests.warned} warned</span>}
          </div>
        </div>
        <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
          {data.tests.results.map((t, i) => (
            <div key={i} className="px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusBadge status={t.status} />
                <span className="text-white text-sm font-mono">{t.test_name}</span>
              </div>
              <span className="text-gray-500 text-xs">{t.execution_time}s</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table Inventory */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h2 className="text-sm text-gray-400 uppercase tracking-wider">Table Inventory</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase border-b border-white/10">
                <th className="px-4 py-2 text-left">Layer</th>
                <th className="px-4 py-2 text-left">Table</th>
                <th className="px-4 py-2 text-right">Rows</th>
                <th className="px-4 py-2 text-right">Columns</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.tables.sort((a, b) => {
                const order: Record<string, number> = { Bronze: 0, Silver: 1, Gold: 2 };
                return (order[a.layer] ?? 3) - (order[b.layer] ?? 3);
              }).map((t, i) => (
                <tr key={i} className="hover:bg-white/5">
                  <td className="px-4 py-2">
                    <span className={`text-xs font-bold ${
                      t.layer === "Bronze" ? "text-amber-600" :
                      t.layer === "Silver" ? "text-gray-300" :
                      "text-yellow-400"
                    }`}>{t.layer}</span>
                  </td>
                  <td className="px-4 py-2 text-white font-mono">{t.schema}.{t.table}</td>
                  <td className="px-4 py-2 text-right text-gray-300">{t.row_count.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{t.column_count ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-600 mt-4 text-right">
        Generated: {new Date(data.generated_at).toLocaleString()}
      </p>
    </div>
  );
}
