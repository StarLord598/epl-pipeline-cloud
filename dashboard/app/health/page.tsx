import Link from "next/link";
import path from "path";
import fs from "fs";
const API_BASE = process.env.NEXT_PUBLIC_CLOUD_API_URL || "https://dr81mm57l8sab.cloudfront.net";

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

interface CloudHealth {
  status: string;
  timestamp: string;
  bucket: string;
  checks: Record<string, { status: string; last_modified: string; size_bytes?: number }>;
}

async function getCloudHealth(): Promise<CloudHealth | null> {
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ── AWS Cloud Resources ── */
const AWS_RESOURCES = {
  compute: [
    { name: "Lambda: Daily Ingest", service: "Lambda", desc: "Ingests standings, scorers, matches daily at 6 AM UTC", icon: "⚡", color: "orange" },
    { name: "Lambda: Live Matches", service: "Lambda", desc: "Polls live match scores every 15 min on matchdays", icon: "⚡", color: "orange" },
    { name: "Lambda: Backfill", service: "Lambda", desc: "Historical season data backfill (on-demand)", icon: "⚡", color: "orange" },
    { name: "Lambda: API Handler", service: "Lambda", desc: "Serves REST API via API Gateway", icon: "⚡", color: "orange" },
    { name: "ECS Fargate: Dashboard", service: "ECS", desc: "Next.js dashboard container (0.25 vCPU, 512 MB)", icon: "🐳", color: "blue" },
  ],
  storage: [
    { name: "S3: Data Lake", service: "S3", desc: "Raw + processed data (Parquet/JSON), partitioned by date", icon: "🪣", color: "green" },
    { name: "S3: Athena Results", service: "S3", desc: "Query result cache for Athena SQL queries", icon: "🪣", color: "green" },
    { name: "S3: Dashboard Static", service: "S3", desc: "Static HTML dashboard backup (S3 website hosting)", icon: "🪣", color: "green" },
    { name: "S3: Terraform State", service: "S3", desc: "Remote state backend with DynamoDB locking", icon: "🪣", color: "green" },
  ],
  orchestration: [
    { name: "Step Functions", service: "SFN", desc: "Orchestrates Lambda pipeline: ingest → transform → serve", icon: "🔄", color: "pink" },
    { name: "EventBridge: Daily Schedule", service: "EventBridge", desc: "Triggers daily pipeline at 6 AM UTC (cron)", icon: "⏰", color: "pink" },
    { name: "EventBridge: Live Poll", service: "EventBridge", desc: "Triggers live match polling every 15 min", icon: "⏰", color: "pink" },
  ],
  data: [
    { name: "Glue Data Catalog", service: "Glue", desc: "Schema registry for S3 data lake tables", icon: "📚", color: "purple" },
    { name: "Athena Workgroup", service: "Athena", desc: "Serverless SQL queries on S3 data (pay-per-query)", icon: "🔍", color: "purple" },
  ],
  networking: [
    { name: "API Gateway (REST)", service: "API GW", desc: "RESTful API endpoints for dashboard data", icon: "🌐", color: "cyan" },
    { name: "CloudFront CDN", service: "CloudFront", desc: "HTTPS + edge caching for API & static assets", icon: "🌐", color: "cyan" },
  ],
  security: [
    { name: "Secrets Manager", service: "Secrets", desc: "football-data.org API key (encrypted, auto-rotated)", icon: "🔐", color: "red" },
    { name: "IAM OIDC Provider", service: "IAM", desc: "GitHub Actions federated auth (no long-lived keys)", icon: "🔐", color: "red" },
    { name: "CloudWatch Dashboard", service: "CloudWatch", desc: "Metrics, alarms, Lambda logs, error tracking", icon: "📊", color: "red" },
  ],
};

const COLOR_MAP: Record<string, string> = {
  orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  green: "bg-green-500/10 text-green-400 border-green-500/20",
  pink: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  red: "bg-red-500/10 text-red-400 border-red-500/20",
};

function ResourceCard({ name, service, desc, icon, color }: { name: string; service: string; desc: string; icon: string; color: string }) {
  return (
    <div className="glass rounded-xl p-3 sm:p-4 hover:bg-white/[0.04] transition-all group">
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm">{name}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${COLOR_MAP[color]}`}>{service}</span>
          </div>
          <p className="text-gray-500 text-xs mt-1 leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}

export default async function HealthPage() {
  const [health, cloudHealth] = await Promise.all([getHealth(), getCloudHealth()]);

  const totalResources = Object.values(AWS_RESOURCES).flat().length;

  // Derive live metrics from Cloud API when available (static file may be stale)
  const liveChecks = cloudHealth?.checks ?? {};
  const liveLastModifieds = Object.values(liveChecks)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((c: any) => c.last_modified)
    .filter(Boolean)
    .sort()
    .reverse();
  const lastIngestLive = liveLastModifieds[0] ?? null;
  const freshnessMinutesLive = lastIngestLive
    ? Math.round((Date.now() - new Date(lastIngestLive).getTime()) / 60000)
    : null;
  const slaStatusLive = freshnessMinutesLive !== null
    ? freshnessMinutesLive <= 60 ? "OK" : freshnessMinutesLive <= 240 ? "WARN" : "ERROR"
    : null;
  const matchCountLive = 380; // Full season

  // Prefer live data over stale static file
  const freshMinutes = freshnessMinutesLive ?? health?.freshness_minutes ?? null;
  const slaStatus = slaStatusLive ?? health?.freshness_status ?? null;
  const lastIngest = lastIngestLive ?? health?.last_ingested_at ?? null;
  const matchCount = health?.active_match_count ?? matchCountLive;

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
                Live monitoring · AWS Cloud Infrastructure
              </p>
            </div>
          </div>
          <Link href="/" className="text-sm text-[#00ff85] hover:text-[#00ff85]/80 transition-colors">
            ← Back to Table
          </Link>
        </div>
      </div>

      {/* Pipeline Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-5">
          <div className="text-gray-500 text-[11px] uppercase tracking-wider font-medium">Freshness (minutes)</div>
          <div className="text-4xl font-black text-white mt-2 tabular-nums">{freshMinutes ?? "—"}</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-gray-500 text-[11px] uppercase tracking-wider font-medium">SLA Status</div>
          <div className={`text-2xl font-bold mt-2 ${
            slaStatus === "OK" ? "text-[#00ff85]" :
            slaStatus === "WARN" ? "text-yellow-400" : "text-red-400"
          }`}>
            {slaStatus ?? "—"}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-gray-500 text-[11px] uppercase tracking-wider font-medium">Active Matches Tracked</div>
          <div className="text-4xl font-black text-white mt-2 tabular-nums">{matchCount ?? "—"}</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-gray-500 text-[11px] uppercase tracking-wider font-medium">Last Ingest Timestamp</div>
          <div className="text-sm font-mono mt-3 text-gray-200 break-all">
            {lastIngest ?? "—"}
          </div>
        </div>
      </div>

      {/* Cloud API Status */}
      {cloudHealth && (
        <div className="mt-6 glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Cloud API Status</h2>
            <span className={`text-xs px-3 py-1 rounded-full font-medium border ${
              cloudHealth.status === "healthy"
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}>
              {cloudHealth.status === "healthy" ? "✓ Healthy" : "✗ Unhealthy"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(cloudHealth.checks).filter(([k]) => k !== "step_function").map(([key, check]) => (
              <div key={key} className="glass rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400 capitalize font-medium">{key}</span>
                  <span className={`w-2 h-2 rounded-full ${check.status === "ok" ? "bg-green-400" : "bg-red-400"}`} />
                </div>
                <p className="text-[11px] text-gray-500">
                  Last updated: <span className="text-gray-300">{check.last_modified ? timeAgo(check.last_modified) : "—"}</span>
                </p>
                {check.size_bytes && (
                  <p className="text-[10px] text-gray-600 mt-0.5">{(check.size_bytes / 1024).toFixed(1)} KB</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 mt-3">
            Endpoint: <code className="px-1.5 py-0.5 bg-white/[0.04] rounded border border-white/[0.06]">{API_BASE}</code>
            {" · "}Checked: {new Date(cloudHealth.timestamp).toLocaleString("en-US", { timeZone: "America/New_York" })} ET
          </p>
        </div>
      )}

      {/* Cloud Pipeline Architecture */}
      <div className="mt-8 glass rounded-2xl p-4 sm:p-5">
        <h2 className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-3">Cloud Pipeline Architecture</h2>
        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-300 flex-wrap">
          <span className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 font-medium border border-blue-500/20">football-data.org</span>
          <span className="text-gray-600">→</span>
          <span className="px-3 py-1.5 rounded-xl bg-orange-500/10 text-orange-400 font-medium border border-orange-500/20">Lambda (Ingest)</span>
          <span className="text-gray-600">→</span>
          <span className="px-3 py-1.5 rounded-xl bg-green-500/10 text-green-400 font-medium border border-green-500/20">S3 Data Lake</span>
          <span className="text-gray-600">→</span>
          <span className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 font-medium border border-purple-500/20">Glue / Athena</span>
          <span className="text-gray-600">→</span>
          <span className="px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-400 font-medium border border-cyan-500/20">API Gateway + CloudFront</span>
          <span className="text-gray-600">→</span>
          <span className="px-3 py-1.5 rounded-xl bg-[#00ff85]/10 text-[#00ff85] font-medium border border-[#00ff85]/20">ECS Dashboard</span>
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-300 flex-wrap">
          <span className="text-gray-600">Orchestration:</span>
          <span className="px-3 py-1.5 rounded-xl bg-pink-500/10 text-pink-400 font-medium border border-pink-500/20">Step Functions</span>
          <span className="text-gray-600">+</span>
          <span className="px-3 py-1.5 rounded-xl bg-pink-500/10 text-pink-400 font-medium border border-pink-500/20">EventBridge (Cron)</span>
        </div>
      </div>

      {/* AWS Cloud Resources */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">AWS Cloud Resources</h2>
          <span className="text-xs px-3 py-1 rounded-full bg-[#FF9900]/10 text-[#FF9900] border border-[#FF9900]/20 font-medium">
            {totalResources} resources · us-east-2
          </span>
        </div>

        <div className="space-y-6">
          {/* Compute */}
          <div>
            <h3 className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">⚡ Compute ({AWS_RESOURCES.compute.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {AWS_RESOURCES.compute.map(r => <ResourceCard key={r.name} {...r} />)}
            </div>
          </div>

          {/* Storage */}
          <div>
            <h3 className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">🪣 Storage ({AWS_RESOURCES.storage.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {AWS_RESOURCES.storage.map(r => <ResourceCard key={r.name} {...r} />)}
            </div>
          </div>

          {/* Orchestration */}
          <div>
            <h3 className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">🔄 Orchestration ({AWS_RESOURCES.orchestration.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {AWS_RESOURCES.orchestration.map(r => <ResourceCard key={r.name} {...r} />)}
            </div>
          </div>

          {/* Data Catalog & Query */}
          <div>
            <h3 className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">📚 Data Catalog & Query ({AWS_RESOURCES.data.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {AWS_RESOURCES.data.map(r => <ResourceCard key={r.name} {...r} />)}
            </div>
          </div>

          {/* Networking */}
          <div>
            <h3 className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">🌐 Networking ({AWS_RESOURCES.networking.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {AWS_RESOURCES.networking.map(r => <ResourceCard key={r.name} {...r} />)}
            </div>
          </div>

          {/* Security & Monitoring */}
          <div>
            <h3 className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-2">🔐 Security & Monitoring ({AWS_RESOURCES.security.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {AWS_RESOURCES.security.map(r => <ResourceCard key={r.name} {...r} />)}
            </div>
          </div>
        </div>
      </div>

      {/* Cost & IaC Footer */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-4">
          <div className="text-gray-500 text-[11px] uppercase tracking-wider font-medium">Infrastructure</div>
          <div className="text-lg font-bold text-[#FF9900] mt-1">Terraform</div>
          <p className="text-gray-500 text-xs mt-1">100% IaC — 14 .tf files</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-gray-500 text-[11px] uppercase tracking-wider font-medium">CI/CD</div>
          <div className="text-lg font-bold text-white mt-1">GitHub Actions</div>
          <p className="text-gray-500 text-xs mt-1">OIDC auth — no long-lived keys</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-gray-500 text-[11px] uppercase tracking-wider font-medium">Est. Monthly Cost</div>
          <div className="text-lg font-bold text-[#00ff85] mt-1">~$1-2/mo</div>
          <p className="text-gray-500 text-xs mt-1">AWS Free Tier eligible</p>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        Region: <code className="px-2 py-1 bg-white/[0.04] rounded-lg border border-white/[0.06]">us-east-2 (Ohio)</code> · Account: <code className="px-2 py-1 bg-white/[0.04] rounded-lg border border-white/[0.06]">606476260881</code>
      </div>
    </div>
  );
}
