import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type Node as RFNode,
  type Edge as RFEdge,
} from "reactflow";
import { Button, Modal } from "antd";

import {
  buildEchelonMap,
  computeEchelonPositions,
  roundNumbers,
} from "./utils";

import type {
  GraphData,
  RawNode,
  RawEdge,
  FlowNodeData,
  FlowEdgeData,
  SupplyEdgeObject,
  SupplyNodeObject,
} from "./network_classes";

import CustomBezierEdge from "./CustomBezierEdge";
import NodeWithHandles from "./NodeWithHandles";
import { JsonTree } from "./components/JsonTree";
import { deriveNodeLabel } from "./utils";
import { updateJsonAtPath } from "./utils";
import { sanitizeToJSONValue } from "./utils";
// import { useDraggable } from './components/useDraggable';

import "reactflow/dist/style.css";
import "./flowStyles.css";
import "./App.css";
import type { JSONValue } from "./components/json-types";

interface SelectionState {
  kind: "node" | "edge";
  id: string;
}

const nodeTypes = { custom: NodeWithHandles };
const edgeTypes = { customBezier: CustomBezierEdge };

export default function App() {
  // graph starts empty, loaded via import
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [nodes, setNodes] = useState<RFNode<FlowNodeData>[]>([]);
  const [edges, setEdges] = useState<RFEdge<FlowEdgeData>[]>([]);
  const [selected, setSelected] = useState<SelectionState | null>(null);
  const [details, setDetails] = useState<JSONValue | null>(null);

  const [sidebarWidth, setSidebarWidth] = useState<number>(360);
  const resizingRef = useRef(false);

  const startResize = (e: React.MouseEvent) => {
    resizingRef.current = true;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const raw = window.innerWidth - e.clientX;
      const clamped = Math.min(
        Math.max(240, raw), // min 240
        window.innerWidth * 0.7 // max 70% ширины окна
      );
      setSidebarWidth(clamped);
    };

    const onUp = () => {
      resizingRef.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Draggable sidebar hook
  // const { nodeRef: sidebarRef, onMouseDown: onSidebarDrag } = useDraggable({ x: 0, y: 0 });

  // Derived data
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
        return {
          id: n.id,
          type: "custom",
          data: {
            label: deriveNodeLabel(obj),
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
          data: {
            offset: 0,
            obj,
          },
          markerEnd: { type: MarkerType.ArrowClosed },
          className: `edge--${obj.edge_type}`,
          style: { strokeWidth: 2, opacity: 1 },
        };
      }),
    [rawEdges, echelonMap]
  );

  // Reset when graph changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelected(null);
    setDetails(null);
  }, [initialNodes, initialEdges]);

  // React Flow handlers
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
    (conn: Connection) => setEdges((eds) => addEdge(conn, eds)),
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
        const obj = edge.data?.obj;
        setDetails(obj ? sanitizeToJSONValue(obj) : null);
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
        const obj = node.data?.obj;
        setDetails(obj ? sanitizeToJSONValue(obj) : null);
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

  // Sync details edits => nodes/edges
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

  // Change of value in JSON tree
  const handleJsonChange = useCallback(
    (path: (string | number)[], next: JSONValue) => {
      setDetails((prev: JSONValue | null) =>
        prev === null ? prev : updateJsonAtPath(prev, path, next)
      );
    },
    []
  );

  // Import / Export
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

  const exportJson = useCallback(() => {
    if (!graph) return;
    const out = {
      graph: {
        nodes: nodes.map((n) => ({ id: n.id, obj: roundNumbers(n.data.obj) })),
        edges: edges.map((e) => ({
          key: e.id,
          source: e.source,
          target: e.target,
          obj: e.data?.obj ?? {}, // data is optional for edges
        })),
      },
      echelons: graph.echelons,
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "export.json";
    link.click();
  }, [nodes, edges, graph]);

  return (
    <div className="app-container">
      <div className="controls" style={{ padding: 8, display: "flex", gap: 8 }}>
        <Button onClick={onImportClick}>Import JSON</Button>
        <input
          type="file"
          accept=".json"
          style={{ display: "none" }}
          ref={fileInputRef}
          onChange={onFileChange}
        />
        <Button type="primary" onClick={exportJson} disabled={!graph}>
          Export JSON
        </Button>
      </div>

      <ReactFlowProvider>
        <div className="reactflow-wrapper">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onElementClick}
            onEdgeClick={onElementClick}
            onPaneClick={resetSelection}
            fitView
            style={{ width: "100%", height: "calc(100vh - 48px)" }}
          />
        </div>
      </ReactFlowProvider>

      <div
        className="sidebar"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: sidebarWidth,
          minWidth: 240,
          maxWidth: "70vw",
          background: "#f8f9fa",
          borderLeft: "1px solid #ddd",
          boxShadow: "0 0 8px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column",
          zIndex: 1000,
          overflow: "hidden",
        }}
      >
        {/* Resizer handle */}
        <div
          onMouseDown={startResize}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 6,
            height: "100%",
            cursor: "col-resize",
            background: "transparent",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(0,0,0,0.06)")
          }
          onMouseLeave={(e) => {
            if (!resizingRef.current)
              e.currentTarget.style.background = "transparent";
          }}
        />

        {/* Header */}
        <div
          style={{
            padding: "10px 14px 8px",
            fontWeight: 600,
            background: "#e9ecef",
            borderBottom: "1px solid #d0d0d0",
            fontSize: 14,
            lineHeight: 1.2,
            flex: "0 0 auto",
          }}
        >
          Details
        </div>

        {/* Content */}
        <div
          style={{
            flex: "1 1 auto",
            overflow: "auto",
            padding: "8px 12px 16px",
            fontSize: 12,
          }}
        >
          {details ? (
            <JsonTree value={details} onChange={handleJsonChange} />
          ) : (
            <div>Select a node or edge</div>
          )}
        </div>
      </div>
    </div>
  );
}
