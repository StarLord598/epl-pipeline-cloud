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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏥</span>
          <div>
            <h1 className="text-2xl font-bold text-white">Pipeline Health</h1>
            <p className="text-gray-400 text-sm">
              Live pipeline monitoring · DuckDB → Airflow → Dashboard
            </p>
          </div>
        </div>
        <Link href="/" className="text-sm text-emerald-300 hover:underline">
          ← Back to Table
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5">
          <div className="text-gray-400 text-xs uppercase tracking-wider">Freshness (minutes)</div>
          <div className="text-4xl font-black text-white mt-2">{health?.freshness_minutes ?? "—"}</div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-gray-400 text-xs uppercase tracking-wider">SLA Status</div>
          <div className={`text-2xl font-bold mt-2 ${
            health?.freshness_status === "OK" ? "text-green-400" :
            health?.freshness_status === "WARN" ? "text-yellow-400" : "text-red-400"
          }`}>
            {health?.freshness_status ?? "—"}
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-gray-400 text-xs uppercase tracking-wider">Active Matches Tracked</div>
          <div className="text-4xl font-black text-white mt-2">{health?.active_match_count ?? "—"}</div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-gray-400 text-xs uppercase tracking-wider">Last Ingest Timestamp</div>
          <div className="text-sm font-mono mt-3 text-gray-200 break-all">
            {health?.last_ingested_at ?? "—"}
          </div>
        </div>
      </div>

      <div className="mt-6 glass rounded-xl p-4">
        <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-3">Pipeline Architecture</h2>
        <div className="flex items-center gap-3 text-sm text-gray-300 flex-wrap">
          <span className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 font-medium">football-data.org</span>
          <span className="text-gray-600">→</span>
          <span className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 font-medium">Airflow (15m)</span>
          <span className="text-gray-600">→</span>
          <span className="px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 font-medium">DuckDB</span>
          <span className="text-gray-600">→</span>
          <span className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 font-medium">dbt</span>
          <span className="text-gray-600">→</span>
          <span className="px-3 py-1.5 rounded-lg bg-[#00ff85]/20 text-[#00ff85] font-medium">Dashboard</span>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        Tip: run <code className="px-2 py-1 bg-white/5 rounded">./scripts/run_live_pipeline.sh</code> and refresh.
      </div>
    </div>
  );
}
