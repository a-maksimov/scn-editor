// App.tsx
import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import ReactFlow, {
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type Node as RFNode,
  type Edge as RFEdge,
  type ReactFlowInstance,
} from "reactflow";
import { Button, Modal, Space, Select } from "antd";

import {
  buildEchelonMap,
  computeEchelonPositions,
  roundNumbers,
  updateJsonAtPath,
  sanitizeToJSONValue,
  buildShortNodeLabel,
} from "./utils";

import {
  type GraphData,
  type RawNode,
  type RawEdge,
  type FlowNodeData,
  type FlowEdgeData,
  type SupplyEdgeObject,
  type SupplyNodeObject,
} from "./components/network_classes";

import CustomBezierEdge from "./components/CustomBezierEdge";
import NodeWithHandles from "./components/NodeWithHandles";
import { JsonTree } from "./components/JsonTree";
import { NODE_TEMPLATES } from "./components/node_templates";
import { EDGE_TEMPLATES } from "./components/edge_templates";
import { Legend } from "./components/legend";

import type { JSONValue } from "./components/json_types";

import "reactflow/dist/style.css";
import "./css/flowStyles.css";
import "./css/App.css";

// --- Вынесенные типы для React Flow (важно чтобы не пересоздавались)
const NODE_TYPES = { custom: NodeWithHandles } as const;
const EDGE_TYPES = { customBezier: CustomBezierEdge } as const;

// --- Утилиты ID
const genNodeId = () => `n_${Date.now().toString(36)}`;
const genEdgeId = (s: string, t: string, et: string) =>
  `${s}__${et}__${t}__${Date.now().toString(36)}`;

const getEdgeTemplate = (edge_type: string) =>
  EDGE_TEMPLATES.find((t) => t.edge_type === edge_type);

const cloneEdgeTemplateObj = (edge_type: string) => {
  const tpl = getEdgeTemplate(edge_type);
  return tpl ? { ...tpl.defaultObj } : ({ edge_type } as SupplyEdgeObject);
};

// --- Выбор (node | edge)
interface SelectionState {
  kind: "node" | "edge";
  id: string;
}

export default function App() {
  // --- Состояния
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [nodes, setNodes] = useState<RFNode<FlowNodeData>[]>([]);
  const [edges, setEdges] = useState<RFEdge<FlowEdgeData>[]>([]);
  const [selected, setSelected] = useState<SelectionState | null>(null);
  const [details, setDetails] = useState<JSONValue | null>(null);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportName, setExportName] = useState("export");

  const [sidebarWidth, setSidebarWidth] = useState<number>(360);
  const resizingRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  // --- Формы добавления
  const [nodeTemplateType, setNodeTemplateType] = useState<
    string | undefined
  >();
  const [edgeForm, setEdgeForm] = useState({
    source: "",
    target: "",
    edge_type: "movement",
  });

  // --- Resize sidebar
  const startResize = (e: React.MouseEvent) => {
    resizingRef.current = true;
    e.preventDefault();
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const raw = window.innerWidth - e.clientX;
      const clamped = Math.min(Math.max(240, raw), window.innerWidth * 0.7);
      setSidebarWidth(clamped);
    };
    const onUp = () => (resizingRef.current = false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // --- Derived
  const rawNodes: RawNode[] = useMemo(() => graph?.graph.nodes ?? [], [graph]);
  const rawEdges: RawEdge[] = useMemo(() => graph?.graph.edges ?? [], [graph]);

  const echelons = useMemo(
    () => (graph ? [...graph.echelons.backwards].reverse() : []),
    [graph]
  );
  const echelonMap = useMemo(() => buildEchelonMap(echelons), [echelons]);

  const positions = useMemo(
    () => computeEchelonPositions(echelons, rawNodes),
    [echelons, rawNodes]
  );

  const initialNodes = useMemo<RFNode<FlowNodeData>[]>(
    () =>
      rawNodes.map((n) => {
        const obj = n.obj as SupplyNodeObject;
        const shortLabel = buildShortNodeLabel(obj, {
          maxLen: 26,
          showType: true,
        });
        return {
          id: n.id,
          type: "custom",
          data: {
            label: shortLabel,
            obj,
          },
          position: positions[n.id] ?? { x: 0, y: 0 },
          className: `node--${obj.node_type}`,
          style: { opacity: 1 },
        };
      }),
    [rawNodes, positions]
  );

  const initialEdges = useMemo<RFEdge<FlowEdgeData>[]>(
    () =>
      rawEdges.map((e) => {
        const obj = e.obj as SupplyEdgeObject;
        const down = echelonMap[e.source] < echelonMap[e.target];
        return {
          id: e.key,
          source: e.source,
          target: e.target,
          type: "customBezier",
          sourceHandle: down ? "source-bottom" : "source-top",
          targetHandle: down ? "target-top" : "target-bottom",
          data: { offset: 0, obj },
          markerEnd: { type: MarkerType.ArrowClosed },
          className: `edge--${obj.edge_type}`,
          style: { strokeWidth: 2, opacity: 1 },
        };
      }),
    [rawEdges, echelonMap]
  );

  // --- Reset при смене graph
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelected(null);
    setDetails(null);
  }, [initialNodes, initialEdges]);

  // --- Добавление узла
  const addNodeFromTemplate = useCallback(() => {
    if (!nodeTemplateType) return;
    const tpl = NODE_TEMPLATES.find((t) => t.node_type === nodeTemplateType);
    if (!tpl) return;

    // центр текущего viewport (если инстанс готов)
    const inst = rfInstanceRef.current;
    const viewport = inst?.getViewport();
    let position = { x: 0, y: 0 };
    if (inst && viewport) {
      const centerScreen = {
        x: window.innerWidth / 2,
        y: (window.innerHeight - 48) / 2,
      };
      position = inst.project({
        x: (centerScreen.x - viewport.x) / viewport.zoom,
        y: (centerScreen.y - viewport.y) / viewport.zoom,
      });
    }

    const id = genNodeId();
    const obj = {
      ...tpl.defaultObj,
      // если нет network_key заранее – заполняем им же
      network_key: tpl.defaultObj.network_key ?? id,
    };

    const newNode: RFNode<FlowNodeData> = {
      id,
      type: "custom",
      data: { label: id, obj },
      position,
      className: `node--${obj.node_type}`,
      style: { opacity: 1 },
    };

    setNodes((ns) => [...ns, newNode]);
    setGraph((g) => {
      if (!g) return g;
      const backwards = [...g.echelons.backwards];
      if (backwards.length === 0) backwards.push([id]);
      else backwards[0] = [...backwards[0], id];
      return {
        ...g,
        graph: {
          ...g.graph,
          nodes: [...g.graph.nodes, { id, obj }],
        },
        echelons: {
          ...g.echelons,
          backwards,
        },
      };
    });
  }, [nodeTemplateType, setNodes, setGraph]);

  // --- Добавление ребра
  const addEdgeManual = useCallback(() => {
    const { source, target, edge_type } = edgeForm;
    if (!source || !target || source === target) return;

    const levelSource = echelonMap[source] ?? 0;
    const levelTarget = echelonMap[target] ?? 0;
    const goesDown = levelSource < levelTarget;

    const id = genEdgeId(source, target, edge_type);
    const tpl =
      EDGE_TEMPLATES.find((t) => t.edge_type === edge_type) ||
      EDGE_TEMPLATES.find((t) => t.edge_type === "movement")!; // fallback

    const edgeObj: SupplyEdgeObject = {
      ...tpl.defaultObj,
      network_key_from: source,
      network_key_to: target,
      // network_key можно синтетически задать, если нужно уникально:
      network_key:
        tpl.defaultObj.network_key ?? `(${source})__${edge_type}__(${target})`,
    };

    const newEdge: RFEdge<FlowEdgeData> = {
      id,
      source,
      target,
      type: "customBezier",
      sourceHandle: goesDown ? "source-bottom" : "source-top",
      targetHandle: goesDown ? "target-top" : "target-bottom",
      data: { obj: edgeObj, offset: 0 },
      markerEnd: { type: MarkerType.ArrowClosed },
      className: `edge--${edgeObj.edge_type}`,
      style: { strokeWidth: 2, opacity: 1 },
    };

    setEdges((es) => [...es, newEdge]);
    setGraph((g) =>
      g
        ? {
            ...g,
            graph: {
              ...g.graph,
              edges: [
                ...g.graph.edges,
                { key: id, source, target, obj: edgeObj },
              ],
            },
          }
        : g
    );
  }, [edgeForm, echelonMap]);

  // --- Удаление выбранного
  const deleteSelected = useCallback(() => {
    if (!selected) return;

    if (selected.kind === "node") {
      setEdges((es) =>
        es.filter((e) => e.source !== selected.id && e.target !== selected.id)
      );
      setNodes((ns) => ns.filter((n) => n.id !== selected.id));
      setGraph((g) =>
        g
          ? {
              ...g,
              graph: {
                nodes: g.graph.nodes.filter((n) => n.id !== selected.id),
                edges: g.graph.edges.filter(
                  (e) => e.source !== selected.id && e.target !== selected.id
                ),
              },
              echelons: {
                forward: g.echelons.forward.map((arr) =>
                  arr.filter((id) => id !== selected.id)
                ),
                backwards: g.echelons.backwards.map((arr) =>
                  arr.filter((id) => id !== selected.id)
                ),
              },
            }
          : g
      );
    } else {
      setEdges((es) => es.filter((e) => e.id !== selected.id));
      setGraph((g) =>
        g
          ? {
              ...g,
              graph: {
                ...g.graph,
                edges: g.graph.edges.filter((e) => e.key !== selected.id),
              },
            }
          : g
      );
    }
    setSelected(null);
    setDetails(null);
  }, [selected]);

  // --- Delete key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteSelected]);

  // --- Export dialog Esc
  useEffect(() => {
    if (!exportOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExportOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exportOpen]);

  // --- Flow handlers
  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;

      const source = conn.source;
      const target = conn.target;

      // не дублировать movement между той же парой
      setEdges((prev) => {
        if (
          prev.some(
            (e) =>
              e.source === source &&
              e.target === target &&
              e.data?.obj.edge_type === "movement"
          )
        ) {
          return prev;
        }

        const edge_type = "movement";
        const levelSource = echelonMap[source] ?? 0;
        const levelTarget = echelonMap[target] ?? 0;
        const goesDown = levelSource < levelTarget;

        const id = genEdgeId(source, target, edge_type);
        const edgeObj = cloneEdgeTemplateObj(edge_type);
        edgeObj.network_key_from = source;
        edgeObj.network_key_to = target;

        const newEdge: RFEdge<FlowEdgeData> = {
          id,
          source: source,
          target: target,
          type: "customBezier",
          sourceHandle: goesDown ? "source-bottom" : "source-top",
          targetHandle: goesDown ? "target-top" : "target-bottom",
          data: { obj: edgeObj, offset: 0 },
          markerEnd: { type: MarkerType.ArrowClosed },
          className: `edge--${edge_type}`,
          style: { strokeWidth: 2, opacity: 1 },
        };

        // синхронизируем graph
        setGraph((g) =>
          g
            ? {
                ...g,
                graph: {
                  ...g.graph,
                  edges: [
                    ...g.graph.edges,
                    {
                      key: id,
                      source: conn.source!,
                      target: conn.target!,
                      obj: edgeObj,
                    },
                  ],
                },
              }
            : g
        );

        return [...prev, newEdge];
      });
    },
    [echelonMap, setGraph]
  );

  const resetSelection = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => ({ ...n, style: { ...n.style, opacity: 1 } }))
    );
    setEdges((eds) =>
      eds.map((e) => ({ ...e, style: { ...e.style, opacity: 1 } }))
    );
    setSelected(null);
    setDetails(null);
  }, []);

  // --- Click (node/edge)
  const onElementClick = useCallback(
    (_: React.MouseEvent, el: RFNode<FlowNodeData> | RFEdge<FlowEdgeData>) => {
      const isEdge = (el as RFEdge).source !== undefined;
      const nodeSet = new Set<string>();
      const edgeSet = new Set<string>();

      if (isEdge) {
        const edge = el as RFEdge<FlowEdgeData>;
        edgeSet.add(edge.id);
        nodeSet.add(edge.source);
        nodeSet.add(edge.target);
        setSelected({ kind: "edge", id: edge.id });
        setDetails(edge.data?.obj ? sanitizeToJSONValue(edge.data.obj) : null);
      } else {
        const node = el as RFNode<FlowNodeData>;
        nodeSet.add(node.id);
        edges.forEach((ed) => {
          if (ed.source === node.id) {
            nodeSet.add(ed.target);
            edgeSet.add(ed.id);
          }
          if (ed.target === node.id) {
            nodeSet.add(ed.source);
            edgeSet.add(ed.id);
          }
        });
        setSelected({ kind: "node", id: node.id });
        setDetails(node.data?.obj ? sanitizeToJSONValue(node.data.obj) : null);
      }

      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          style: { ...n.style, opacity: nodeSet.has(n.id) ? 1 : 0.1 },
        }))
      );
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          style: { ...e.style, opacity: edgeSet.has(e.id) ? 1 : 0.05 },
        }))
      );
    },
    [edges]
  );

  // --- Sync edits из дерева JSON
  useEffect(() => {
    if (!selected || details === null) return;
    if (selected.kind === "node") {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selected.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  obj: details as unknown as SupplyNodeObject,
                },
              }
            : n
        )
      );
    } else {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === selected.id
            ? {
                ...e,
                data: {
                  ...e.data,
                  obj: details as unknown as SupplyEdgeObject,
                },
              }
            : e
        )
      );
    }
  }, [details, selected]);

  const handleJsonChange = useCallback(
    (path: (string | number)[], next: JSONValue) => {
      setDetails((prev) =>
        prev === null ? prev : updateJsonAtPath(prev, path, next)
      );
    },
    []
  );

  // --- Import
  const onImportClick = () => fileInputRef.current?.click();
  const onFileChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        setGraph(json);
      } catch {
        Modal.error({ title: "Import error", content: "Invalid JSON file." });
      }
    };
    reader.readAsText(file);
    evt.target.value = "";
  };

  // --- Export
  const performExport = useCallback(
    (filename: string) => {
      if (!graph) return;
      const out = {
        graph: {
          nodes: nodes.map((n) => ({
            id: n.id,
            obj: roundNumbers(n.data.obj),
          })),
          edges: edges.map((e) => ({
            key: e.id,
            source: e.source,
            target: e.target,
            obj: e.data.obj,
          })),
        },
        echelons: graph.echelons,
      };
      const blob = new Blob([JSON.stringify(out, null, 2)], {
        type: "application/json",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const safe = filename.trim() === "" ? "export" : filename.trim();
      link.download = safe.endsWith(".json") ? safe : `${safe}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
    },
    [nodes, edges, graph]
  );

  // --- UI
  return (
    <div className="app-root">
      <div
        style={{
          position: "absolute",
          left: 8,
          top: 8,
          zIndex: 50,
          background: "rgba(255,255,255,0.9)",
          padding: 8,
          borderRadius: 4,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          maxWidth: "calc(100% - 400px)",
        }}
      >
        <Space wrap align="center" style={{ rowGap: 4 }}>
          <Button onClick={onImportClick}>Import</Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={onFileChange}
          />
          <Button
            type="primary"
            disabled={!graph}
            onClick={() => {
              if (graph) {
                setExportName("export_network");
                setExportOpen(true);
              }
            }}
          >
            Export
          </Button>

          <Select
            placeholder="Node template"
            style={{ width: 150 }}
            value={nodeTemplateType}
            onChange={(v) => setNodeTemplateType(v)}
            options={NODE_TEMPLATES.map((t) => ({
              label: t.node_type,
              value: t.node_type,
            }))}
          />
          <Button
            onClick={addNodeFromTemplate}
            disabled={!nodeTemplateType || !graph}
          >
            Add Node
          </Button>

          <Select
            placeholder="Source"
            style={{ width: 120 }}
            value={edgeForm.source}
            onChange={(v) => setEdgeForm((f) => ({ ...f, source: v }))}
            options={nodes.map((n) => ({ label: n.id, value: n.id }))}
          />
          <Select
            placeholder="Target"
            style={{ width: 120 }}
            value={edgeForm.target}
            onChange={(v) => setEdgeForm((f) => ({ ...f, target: v }))}
            options={nodes.map((n) => ({ label: n.id, value: n.id }))}
          />
          <Select
            style={{ width: 130 }}
            value={edgeForm.edge_type}
            onChange={(v) => setEdgeForm((f) => ({ ...f, edge_type: v }))}
            options={[
              { label: "movement", value: "movement" },
              { label: "supply", value: "supply" },
              { label: "bom", value: "bom" },
              { label: "undefined", value: "undefined" },
            ]}
          />
          <Button
            onClick={addEdgeManual}
            disabled={!edgeForm.source || !edgeForm.target || !graph}
          >
            Add Edge
          </Button>
          <Button danger disabled={!selected} onClick={deleteSelected}>
            Delete Selected
          </Button>
          <Button onClick={resetSelection} disabled={!selected}>
            Reset Selection
          </Button>
        </Space>
      </div>
      <Legend />
      <div className="flow-area">
        <div className="reactflow-wrapper">
          <ReactFlow
            onInit={(inst) => {
              rfInstanceRef.current = inst;
            }}
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onElementClick}
            onEdgeClick={onElementClick}
            onPaneClick={resetSelection}
            fitView
          />
        </div>
      </div>

      <aside
        style={{
          width: sidebarWidth,
          minWidth: 240,
          maxWidth: "70vw",
          borderLeft: "1px solid #ddd",
          background: "#f8f9fa",
          height: "100%",
          overflow: "auto",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div
          onMouseDown={startResize}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 6,
            height: "100%",
            cursor: "col-resize",
            zIndex: 10,
          }}
        />
        <div
          style={{
            padding: "10px 14px 8px",
            fontWeight: 600,
            background: "#e9ecef",
            borderBottom: "1px solid #d0d0d0",
            fontSize: 14,
          }}
        >
          Details
        </div>
        <div style={{ padding: "8px 12px 16px", fontSize: 12 }}>
          {details ? (
            <JsonTree value={details} onChange={handleJsonChange} />
          ) : (
            <div>Select a node or edge</div>
          )}
        </div>
      </aside>

      <Modal
        title="Export JSON"
        open={exportOpen}
        onOk={() => {
          performExport(exportName);
          setExportOpen(false);
        }}
        onCancel={() => setExportOpen(false)}
        okText="Save"
      >
        <input
          autoFocus
          value={exportName}
          onChange={(e) => setExportName(e.target.value)}
          style={{ width: "100%", padding: 6 }}
          placeholder="export"
        />
        <div style={{ fontSize: 12, marginTop: 4, color: "#666" }}>
          “.json” will be appended if not present.
        </div>
      </Modal>
    </div>
  );
}
