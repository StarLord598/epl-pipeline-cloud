"use client";

import { useEffect, useState } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  Handle,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import DataSourceBadge from "@/components/DataSourceBadge";

interface LineageNode {
  id: string;
  name: string;
  resource_type: string;
  layer: string;
  description: string;
  columns: number;
  materialized: string;
}

interface LineageEdge {
  source: string;
  target: string;
}

interface LineageData {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

const layerColors: Record<string, { bg: string; border: string; text: string }> = {
  source: { bg: "#064e3b", border: "#10b981", text: "#6ee7b7" },
  staging: { bg: "#1e3a5f", border: "#3b82f6", text: "#93c5fd" },
  mart: { bg: "#4c1d95", border: "#8b5cf6", text: "#c4b5fd" },
  dimension: { bg: "#78350f", border: "#f59e0b", text: "#fcd34d" },
  seed: { bg: "#374151", border: "#9ca3af", text: "#d1d5db" },
};

const layerLabels: Record<string, string> = {
  source: "🥉 Source (Bronze)",
  staging: "🥈 Staging (Silver)",
  mart: "🥇 Mart (Gold)",
  dimension: "📐 Dimension",
  seed: "🌱 Seed",
};

const matIcons: Record<string, string> = {
  view: "👁",
  table: "📊",
  incremental: "⚡",
  ephemeral: "💨",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomNode({ data }: { data: Record<string, any> }) {
  const colors = layerColors[data.layer] || layerColors.seed;
  return (
    <div
      style={{
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: 12,
        padding: "12px 16px",
        minWidth: 200,
        maxWidth: 280,
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: colors.border }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>
          {data.name}
        </span>
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          {matIcons[data.materialized] || "📄"} {data.materialized}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
        {layerLabels[data.layer] || data.layer}
      </div>
      {data.description && (
        <div style={{ fontSize: 10, color: "#cbd5e1", lineHeight: 1.3, marginBottom: 4 }}>
          {data.description.slice(0, 80)}{data.description.length > 80 ? "…" : ""}
        </div>
      )}
      {data.columns > 0 && (
        <div style={{ fontSize: 10, color: "#64748b" }}>
          {data.columns} columns
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: colors.border }} />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 200, edgesep: 30 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 240, height: 100 });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - 120, y: pos.y - 50 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export default function LineagePage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ nodes: 0, edges: 0, sources: 0, models: 0 });

  useEffect(() => {
    fetch("/data/lineage.json")
      .then((r) => r.json())
      .then((data: LineageData) => {
        const flowNodes: Node[] = data.nodes.map((n) => ({
          id: n.id,
          type: "custom",
          data: { ...n },
          position: { x: 0, y: 0 },
        }));

        const flowEdges: Edge[] = data.edges.map((e, i) => ({
          id: `e-${i}`,
          source: e.source,
          target: e.target,
          animated: true,
          style: { stroke: "#6366f1", strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
        }));

        const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(flowNodes, flowEdges);
        setNodes(layouted);
        setEdges(layoutedEdges);
        setStats({
          nodes: data.nodes.length,
          edges: data.edges.length,
          sources: data.nodes.filter((n) => n.resource_type === "source").length,
          models: data.nodes.filter((n) => n.resource_type === "model").length,
        });
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              Interactive dependency graph — {stats.sources} sources → {stats.models} models · {stats.edges} edges
            </p>
          </div>
        </div>
        <DataSourceBadge
          pattern="Data Lineage (DAG)"
          source="18 dbt models (facts, dimensions, SCDs, snapshots) · 9 sources · 37 tests"
          explanation="Auto-generated dependency graph showing the full medallion architecture: raw sources → staging views (deduplication, type casting) → Gold marts (facts, dimensions, SCD Type 2, rolling aggregates). Every model, column, and test is documented with contracts. Enables impact analysis: if raw.live_matches schema changes, trace which downstream staging views, fact tables, and dimensions break."
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(layerColors).map(([layer, colors]) => (
          <div
            key={layer}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
            style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
          >
            {layerLabels[layer] || layer}
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl overflow-hidden" style={{ height: "calc(100vh - 280px)" }}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            Loading lineage graph...
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={2}
            attributionPosition="bottom-left"
          >
            <Background color="#334155" gap={20} size={1} />
            <Controls
              style={{
                background: "#1e293b",
                borderRadius: 8,
                border: "1px solid #334155",
              }}
            />
            <MiniMap
              nodeColor={(node) => {
                const layer = node.data?.layer as string;
                return layerColors[layer]?.border || "#6b7280";
              }}
              style={{
                background: "#0f172a",
                borderRadius: 8,
                border: "1px solid #334155",
              }}
              maskColor="rgba(0, 0, 0, 0.5)"
            />
          </ReactFlow>
        )}
      </div>

      {/* Also link to full dbt docs */}
      <div className="mt-4 text-center">
        <a
          href="/dbt-docs/index.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 text-sm underline"
        >
          Open full dbt docs (interactive explorer) →
        </a>
      </div>
    </div>
  );
}
