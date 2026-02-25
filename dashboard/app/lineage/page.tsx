"use client";

import DataSourceBadge from "@/components/DataSourceBadge";

export default function LineagePage() {
  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <div className="flex items-center gap-4 mb-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <span className="text-2xl">🔗</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Data Lineage</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Interactive dependency graph — powered by dbt docs
            </p>
          </div>
        </div>
        <DataSourceBadge
          pattern="Data Lineage (DAG)"
          source="18 dbt models (facts, dimensions, SCDs, snapshots) · 9 sources · 37 tests"
          explanation="Auto-generated dependency graph showing the full medallion architecture: raw sources → staging views (deduplication, type casting) → Gold marts (facts, dimensions, SCD Type 2, rolling aggregates). Every model, column, and test is documented with contracts. Enables impact analysis: if raw.live_matches schema changes, trace which downstream staging views, fact tables, and dimensions break. Hosted on AWS: S3 data lake → Glue Catalog → Athena-queryable layers."
        />
      </div>
      <div className="glass rounded-2xl overflow-hidden" style={{ height: "calc(100vh - 200px)" }}>
        <iframe
          src="/dbt-docs/index.html"
          className="w-full h-full border-0"
          title="dbt Data Lineage"
        />
      </div>
    </div>
  );
}
