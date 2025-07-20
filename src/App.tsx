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
} from "./utils";

import {
  type GraphData,
  type FlowNodeData,
  type FlowEdgeData,
  type SupplyEdgeObject,
  type SupplyNodeObject,
  EMPTY_GRAPH,
} from "./components/network_classes";

import CustomBezierEdge from "./components/CustomBezierEdge";
import NodeWithHandles from "./components/NodeWithHandles";
import { JsonTree } from "./components/JsonTree";
import {
  buildInitialSaleStream,
  NODE_TEMPLATES,
} from "./components/node_templates";
import { EDGE_TEMPLATES } from "./components/edge_templates";
import { Legend } from "./components/legend";

import type { JSONValue } from "./components/json_types";
import {
  getNodeType,
  hasMaxOutEdge,
  isPairAllowed,
  resolveEdgeType,
} from "./components/network_builder";
import { KEY_CONFIG } from "./components/network_builder";

const NODE_TYPES = { custom: NodeWithHandles } as const;
const EDGE_TYPES = { customBezier: CustomBezierEdge } as const;

const genEdgeId = (s: string, t: string, et: string) =>
  `${s}__${et}__${t}__${Date.now().toString(36)}`;

const getEdgeTemplate = (edge_type: string) =>
  EDGE_TEMPLATES.find((t) => t.edge_type === edge_type);

const cloneEdgeTemplateObj = (edge_type: string) => {
  const tpl = getEdgeTemplate(edge_type);
  return tpl ? { ...tpl.defaultObj } : ({ edge_type } as SupplyEdgeObject);
};

interface SelectionState {
  kind: "node" | "edge";
  id: string;
}

type NewNodeModalState = {
  open: boolean;
  nodeType: string | null;
  values: Record<string, string>;
  errors: Record<string, string>;
};

type UiMessage = {
  type: "error" | "warning" | "info";
  text: string;
  ts: number;
} | null;

export default function App() {
  const [uiMessage, setUiMessage] = useState<UiMessage>(null);
  const [frozenPositions, setFrozenPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [nodes, setNodes] = useState<RFNode<FlowNodeData>[]>([]);
  const [edges, setEdges] = useState<RFEdge<FlowEdgeData>[]>([]);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportName, setExportName] = useState("export");

  const [selected, setSelected] = useState<SelectionState | null>(null);
  const [details, setDetails] = useState<JSONValue | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(360);
  const [nodeTemplateType, setNodeTemplateType] = useState<
    string | undefined
  >();

  const [edgeForm, setEdgeForm] = useState({
    source: "",
    target: "",
    edge_type: "movement",
  });

  const [newNodeModal, setNewNodeModal] = useState<NewNodeModalState>({
    open: false,
    nodeType: null,
    values: {},
    errors: {},
  });

  // Messages
  useEffect(() => {
    if (!uiMessage) return;
    const t = setTimeout(() => setUiMessage(null), 5000);
    return () => clearTimeout(t);
  }, [uiMessage]);

  const pushMessage = useCallback(
    (type: NonNullable<UiMessage>["type"], text: string) =>
      setUiMessage({ type, text, ts: Date.now() }),
    []
  );

  const canvasFocusedRef = useRef(false);
  const markCanvasFocused = () => {
    canvasFocusedRef.current = true;
  };

  // Initialize graph from JSON
  const echelons = useMemo(
    () => (graph ? [...graph.echelons.backwards].reverse() : []),
    [graph]
  );
  const echelonMap = useMemo(() => buildEchelonMap(echelons), [echelons]);

  // Resize sidebar
  const resizingRef = useRef(false);
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
  const startResize = (e: React.MouseEvent) => {
    resizingRef.current = true;
    e.preventDefault();
  };

  // Add node
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  const openAddNodeModal = useCallback(() => {
    if (!nodeTemplateType) return;
    setNewNodeModal({
      open: true,
      nodeType: nodeTemplateType,
      values: {},
      errors: {},
    });
  }, [nodeTemplateType]);

  const addNodeFromTemplate = useCallback(
    (nodeType: string, networkKey: string, values: Record<string, string>) => {
      // 1. Find template
      const type_template = NODE_TEMPLATES.find(
        (t) => t.node_type === nodeType
      );
      if (!type_template) {
        console.error("Template not found for node type", nodeType);
        return;
      }

      // 2. Copy defaultObj
      const obj = JSON.parse(JSON.stringify(type_template.defaultObj));
      obj.network_key = networkKey;

      // Get client/location/product and form an initial stream
      if (nodeType === "sale") {
        obj.streams = [buildInitialSaleStream(networkKey, values)];
      }

      // 3. Set position
      let position = { x: 0, y: 0 };
      const inst = rfInstanceRef.current;
      const viewport = inst?.getViewport();
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

      // 4. Node
      const newNode: RFNode<FlowNodeData> = {
        id: networkKey,
        type: "custom",
        data: { label: networkKey, obj },
        position,
        className: `node--${type_template.node_type}`, // стили по типу
      };

      // 5. Add state to React Flow
      setNodes((ns) => [...ns, newNode]);

      // 6. Sync with graph
      setGraph((g) => {
        const base = g ?? EMPTY_GRAPH;

        const nodes = [...base.graph.nodes, { id: networkKey, obj }];
        let backwards = [...base.echelons.backwards];
        let forward = [...base.echelons.forward];

        if (backwards.length === 0) {
          backwards = [[networkKey]];
        } else {
          backwards[0] = [...backwards[0], networkKey];
        }

        if (forward.length === 0) {
          forward = [[networkKey]];
        } else {
          const lastIdx = forward.length - 1;
          forward[lastIdx] = [...forward[lastIdx], networkKey];
        }
        return {
          graph: { ...base.graph, nodes },
          echelons: { backwards, forward },
        };
      });
    },
    [setNodes, setGraph]
  );

  const submitNewNode = useCallback(() => {
    if (!newNodeModal.nodeType) return;
    const cfg = KEY_CONFIG[newNodeModal.nodeType];
    if (!cfg) return;

    // simple validation
    const errs: Record<string, string> = {};
    cfg.fields.forEach((f) => {
      if (!newNodeModal.values[f]?.trim()) errs[f] = "Required";
    });
    if (Object.keys(errs).length) {
      setNewNodeModal((s) => ({ ...s, errors: errs }));
      return;
    }

    const networkKey = cfg.build(newNodeModal.values);

    if (nodes.some((n) => n.id === networkKey)) {
      setNewNodeModal((s) => ({
        ...s,
        errors: { ...s.errors, _dup: "Node with this key already exists" },
      }));
      return;
    }

    addNodeFromTemplate(newNodeModal.nodeType, networkKey, newNodeModal.values);

    setNewNodeModal({
      open: false,
      nodeType: null,
      values: {},
      errors: {},
    });
  }, [newNodeModal, nodes, addNodeFromTemplate]);

  // Add edge
  const addEdgeManual = useCallback(() => {
    const { source, target, edge_type: chosen } = edgeForm;
    if (!source || !target || source === target) return;

    const srcType = getNodeType(nodes, source);
    if (hasMaxOutEdge(source, srcType!, edges)) {
      pushMessage(
        "warning",
        `${srcType} node '${source}' already has an outgoing edge (only 1 allowed).`
      );
      return;
    }

    const tgtType = getNodeType(nodes, target);
    if (!isPairAllowed(srcType, tgtType)) {
      pushMessage(
        "error",
        `Connection ${srcType || "?"} → ${tgtType || "?"} is not allowed.`
      );
      return;
    }
    const resolved = resolveEdgeType(srcType!, tgtType!, chosen);

    const levelSource = echelonMap[source] ?? 0;
    const levelTarget = echelonMap[target] ?? 0;
    const goesDown = levelSource < levelTarget;

    const id = genEdgeId(source, target, resolved);
    const tpl =
      EDGE_TEMPLATES.find((t) => t.edge_type === resolved) ||
      EDGE_TEMPLATES.find((t) => t.edge_type === "undefined")!;

    const edgeObj: SupplyEdgeObject = {
      ...tpl.defaultObj,
      network_key_from: source,
      network_key_to: target,
      // unique synthetic network_key for edge
      network_key:
        tpl.defaultObj.network_key ?? `(${source})__${resolved}__(${target})`,
    };

    const newEdge: RFEdge<FlowEdgeData> = {
      id,
      source,
      target,
      type: "customBezier",
      sourceHandle: goesDown ? "source-bottom" : "source-top",
      targetHandle: goesDown ? "target-top" : "target-bottom",
      data: { obj: edgeObj },
      markerEnd: { type: MarkerType.ArrowClosed },
      className: `edge--${resolved}`,
    };

    setEdges((es) => [...es, newEdge]);
    setGraph((g) => {
      const base = g ?? EMPTY_GRAPH;
      return {
        ...base,
        graph: {
          ...base.graph,
          edges: [
            ...base.graph.edges,
            { key: id, source, target, obj: edgeObj },
          ],
        },
      };
    });
  }, [edgeForm, nodes, edges, echelonMap, pushMessage]);

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;

      const source = conn.source;
      const target = conn.target;

      const srcType = getNodeType(nodes, source);
      if (hasMaxOutEdge(source, srcType!, edges)) {
        pushMessage(
          "warning",
          `${srcType} node '${source}' already has an outgoing edge (only 1 allowed).`
        );
        return;
      }

      const tgtType = getNodeType(nodes, target);
      if (!isPairAllowed(srcType, tgtType)) {
        pushMessage(
          "error",
          `Connection ${srcType || "?"} → ${tgtType || "?"} is not allowed.`
        );
        return;
      }

      const resolved = resolveEdgeType(srcType!, tgtType!, "undefined");

      // do not duplicate movements
      setEdges((prev) => {
        if (
          prev.some(
            (e) =>
              e.source === source &&
              e.target === target &&
              e.data?.obj.edge_type === resolved
          )
        ) {
          pushMessage(
            "warning",
            `Edge ${source} → ${target} (${resolved}) already exists.`
          );
          return prev;
        }

        const levelSource = echelonMap[source] ?? 0;
        const levelTarget = echelonMap[target] ?? 0;
        const goesDown = levelSource < levelTarget;

        const id = genEdgeId(source, target, resolved);
        const edgeObj = cloneEdgeTemplateObj(resolved);
        edgeObj.network_key_from = source;
        edgeObj.network_key_to = target;

        const newEdge: RFEdge<FlowEdgeData> = {
          id,
          source,
          target,
          type: "customBezier",
          sourceHandle: goesDown ? "source-bottom" : "source-top",
          targetHandle: goesDown ? "target-top" : "target-bottom",
          data: { obj: edgeObj },
          markerEnd: { type: MarkerType.ArrowClosed },
          className: `edge--${resolved}`,
        };

        setGraph((g) => {
          const base = g ?? EMPTY_GRAPH;
          return {
            ...base,
            graph: {
              ...base.graph,
              edges: [
                ...base.graph.edges,
                { key: id, source, target, obj: edgeObj },
              ],
            },
          };
        });
        return [...prev, newEdge];
      });
    },
    [nodes, edges, pushMessage, echelonMap]
  );

  // Delete selected edge or node
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

  const confirmDeleteSelected = useCallback(() => {
    if (!selected) return;
    Modal.confirm({
      title: "Delete selected?",
      content:
        selected.kind === "node"
          ? `Node '${selected.id}' and its connected edges will be removed.`
          : `Edge '${selected.id}' will be removed.`,
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: () => {
        deleteSelected();
      },
    });
  }, [selected, deleteSelected]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Delete") return;

      if (!canvasFocusedRef.current) return;

      const ae = document.activeElement as HTMLElement | null;
      if (
        ae &&
        (ae.tagName === "INPUT" ||
          ae.tagName === "TEXTAREA" ||
          ae.isContentEditable)
      )
        return;

      if (!selected) return;

      confirmDeleteSelected();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, confirmDeleteSelected]);

  // Click (node/edge)
  const onElementClick = useCallback(
    (_: React.MouseEvent, el: RFNode<FlowNodeData> | RFEdge<FlowEdgeData>) => {
      markCanvasFocused();
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

  // Sync edits from JSON Tree
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

  // Import
  const onImportClick = () => fileInputRef.current?.click();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function initializeGraph(g: GraphData) {
    setGraph(g);
    const echelons = [...g.echelons.backwards].reverse();
    const rawNodes = g.graph.nodes;
    const layout = computeEchelonPositions(echelons, rawNodes);

    setFrozenPositions(layout);

    const nodesInit: RFNode<FlowNodeData>[] = rawNodes.map((n) => {
      const obj = n.obj;
      return {
        id: n.id,
        type: "custom",
        data: { label: n.id, obj },
        position: layout[n.id] ?? { x: 0, y: 0 },
        className: `node--${obj.node_type ?? "undefined"}`,
      };
    });

    const edgesInit = g.graph.edges.map((e) => {
      const obj = e.obj;
      return {
        id: e.key,
        source: e.source,
        target: e.target,
        type: "customBezier",
        data: { obj },
        markerEnd: { type: MarkerType.ArrowClosed },
        className: `edge--${obj.edge_type}`,
      } as RFEdge<FlowEdgeData>;
    });

    setNodes(nodesInit);
    setEdges(edgesInit);
    setSelected(null);
    setDetails(null);
  }

  const onFileChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        initializeGraph(json);
      } catch {
        Modal.error({ title: "Import error", content: "Invalid JSON file." });
      }
    };
    reader.readAsText(file);
    evt.target.value = "";
  };

  // Export dialog Esc
  useEffect(() => {
    if (!exportOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExportOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exportOpen]);

  // Export
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
            obj: e.data ? (e.data as FlowEdgeData).obj : undefined,
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

  // Flow handlers
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
          <Button
            disabled={!nodes.length}
            onClick={() => {
              setNodes((prev) =>
                prev.map((n) => {
                  const pos = frozenPositions[n.id];
                  return pos ? { ...n, position: pos } : n;
                })
              );
            }}
          >
            Re-layout
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
          <Button onClick={openAddNodeModal} disabled={!nodeTemplateType}>
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
            disabled={!edgeForm.source || !edgeForm.target}
          >
            Add Edge
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
            onNodeClick={(e, n) => {
              markCanvasFocused();
              onElementClick(e, n);
            }}
            onEdgeClick={(e, ed) => {
              markCanvasFocused();
              onElementClick(e, ed);
            }}
            onPaneClick={() => {
              markCanvasFocused();
              resetSelection();
            }}
            fitView
            isValidConnection={(conn) => {
              const sType = conn.source
                ? getNodeType(nodes, conn.source)
                : undefined;
              const tType = conn.target
                ? getNodeType(nodes, conn.target)
                : undefined;
              return isPairAllowed(sType, tType);
            }}
          />
        </div>
      </div>
      <aside
        onMouseDown={() => {
          canvasFocusedRef.current = false;
        }}
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
            <div>
              <div style={{ fontSize: 12, color: "#666", padding: "4px 0" }}>
                Select a node or edge
              </div>
            </div>
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
      <Modal
        open={newNodeModal.open}
        title={`Create ${newNodeModal.nodeType || ""} node`}
        okText="Create"
        onOk={submitNewNode}
        onCancel={() =>
          setNewNodeModal({
            open: false,
            nodeType: null,
            values: {},
            errors: {},
          })
        }
      >
        {newNodeModal.nodeType &&
          (() => {
            const cfg = KEY_CONFIG[newNodeModal.nodeType];
            if (!cfg) return <div>Unknown node type</div>;
            return (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {cfg.fields.map((field, i) => {
                  const val = newNodeModal.values[field] || "";
                  const err = newNodeModal.errors[field];
                  return (
                    <div
                      key={field}
                      style={{ display: "flex", flexDirection: "column" }}
                    >
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          marginBottom: 4,
                        }}
                      >
                        {field} *
                      </label>
                      <input
                        autoFocus={i === 0}
                        value={val}
                        onChange={(e) => {
                          const v = e.target.value;
                          setNewNodeModal((s) => ({
                            ...s,
                            values: { ...s.values, [field]: v },
                            errors: { ...s.errors, [field]: "" },
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitNewNode();
                        }}
                        style={{
                          width: "100%",
                          padding: 6,
                          border: `1px solid ${err ? "#d00" : "#ccc"}`,
                          borderRadius: 4,
                          fontSize: 13,
                        }}
                      />
                      {err && (
                        <div style={{ color: "#d00", fontSize: 11 }}>{err}</div>
                      )}
                    </div>
                  );
                })}
                {/* Preview */}
                <div
                  style={{
                    fontFamily: "monospace",
                    background: "#f6f6f6",
                    padding: 8,
                    border: "1px solid #eee",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  {(() => {
                    const partial: Record<string, string> = {};
                    cfg.fields.forEach(
                      (f) => (partial[f] = newNodeModal.values[f] || "?")
                    );
                    return cfg.build(partial);
                  })()}
                </div>
                {newNodeModal.errors._dup && (
                  <div style={{ color: "#d00", fontSize: 12 }}>
                    {newNodeModal.errors._dup}
                  </div>
                )}
              </div>
            );
          })()}
      </Modal>
      {uiMessage && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2000,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
            padding: "0 12px 12px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              maxWidth: 640,
              width: "100%",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              lineHeight: 1.4,
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              border: "1px solid",
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              background:
                uiMessage.type === "error"
                  ? "#fff5f5"
                  : uiMessage.type === "warning"
                  ? "#fffbea"
                  : "#f2f8ff",
              borderColor:
                uiMessage.type === "error"
                  ? "#ffc2c2"
                  : uiMessage.type === "warning"
                  ? "#ffe6a3"
                  : "#b5d9ff",
              color:
                uiMessage.type === "error"
                  ? "#7a1212"
                  : uiMessage.type === "warning"
                  ? "#7a5d00"
                  : "#0b4d85",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                textTransform: "uppercase",
                fontSize: 11,
              }}
            >
              {uiMessage.type}
            </div>
            <div style={{ flex: 1 }}>{uiMessage.text}</div>
            <button
              onClick={() => setUiMessage(null)}
              style={{
                border: "none",
                background: "transparent",
                color: "inherit",
                fontSize: 18,
                lineHeight: 1,
                cursor: "pointer",
                padding: 0,
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
