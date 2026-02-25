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
          pattern="Data Lineage"
          source="dbt docs — 18 models across S3 → Glue → Athena layers, 9 sources, 37 tests"
          explanation="Auto-generated DAG showing full dependency graph across the AWS cloud pipeline: Lambda-ingested S3 sources → Glue-cataloged staging views → Athena-queryable Gold marts. Every model, column, and test is documented. Enables impact analysis: if the Lambda ingest schema changes, trace which downstream S3 partitions, Glue tables, and Athena views break."
        />
      </div>
      <div className="glass rounded-2xl overflow-hidden" style={{ height: "calc(100vh - 200px)" }}>
        <iframe
          src="/lineage/index.html"
          className="w-full h-full border-0"
          title="dbt Data Lineage"
        />
      </div>
    </div>
  );
}
