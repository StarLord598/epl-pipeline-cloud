import Link from "next/link";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

async function getHealth() {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "live_monitor.json");
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export default async function HealthPage() {
  const health = await getHealth();

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <span className="text-2xl">🏥</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Pipeline Health</h1>
              <p className="text-gray-400 text-sm mt-0.5">
                Live pipeline monitoring · DuckDB → Airflow → Dashboard
              </p>
            </div>
          </div>
          <Link href="/" className="text-sm text-[#00ff85] hover:text-[#00ff85]/80 transition-colors">
            ← Back to Table
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-5">
          <div className="text-gray-500 text-[11px] uppercase tracking-wider font-medium">Freshness (minutes)</div>
          <div className="text-4xl font-black text-white mt-2 tabular-nums">{health?.freshness_minutes ?? "—"}</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-gray-500 text-[11px] uppercase tracking-wider font-medium">SLA Status</div>
          <div className={`text-2xl font-bold mt-2 ${
            health?.freshness_status === "OK" ? "text-[#00ff85]" :
            health?.freshness_status === "WARN" ? "text-yellow-400" : "text-red-400"
          }`}>
            {health?.freshness_status ?? "—"}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-gray-500 text-[11px] uppercase tracking-wider font-medium">Active Matches Tracked</div>
          <div className="text-4xl font-black text-white mt-2 tabular-nums">{health?.active_match_count ?? "—"}</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-gray-500 text-[11px] uppercase tracking-wider font-medium">Last Ingest Timestamp</div>
          <div className="text-sm font-mono mt-3 text-gray-200 break-all">
            {health?.last_ingested_at ?? "—"}
          </div>
        </div>
      </div>

      <div className="mt-6 glass rounded-2xl p-4 sm:p-5">
        <h2 className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-3">Pipeline Architecture</h2>
        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-300 flex-wrap">
          <span className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 font-medium border border-blue-500/20">football-data.org</span>
          <span className="text-gray-600">→</span>
          <span className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 font-medium border border-purple-500/20">Airflow (15m)</span>
          <span className="text-gray-600">→</span>
          <span className="px-3 py-1.5 rounded-xl bg-orange-500/10 text-orange-400 font-medium border border-orange-500/20">DuckDB</span>
          <span className="text-gray-600">→</span>
          <span className="px-3 py-1.5 rounded-xl bg-green-500/10 text-green-400 font-medium border border-green-500/20">dbt</span>
          <span className="text-gray-600">→</span>
          <span className="px-3 py-1.5 rounded-xl bg-[#00ff85]/10 text-[#00ff85] font-medium border border-[#00ff85]/20">Dashboard</span>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        Tip: run <code className="px-2 py-1 bg-white/[0.04] rounded-lg border border-white/[0.06]">./scripts/run_live_pipeline.sh</code> and refresh.
      </div>
    </div>
  );
}
