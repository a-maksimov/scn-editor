// src/App.tsx
import React, { useState, useCallback, useMemo, useRef } from 'react'
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
} from 'reactflow'
import { Button, Form, Input, Typography, Modal } from 'antd'

import {
  buildEchelonMap,
  computeEchelonPositions,
  roundNumbers,
} from './utils'

import { type GraphData, type RawEdge as UtilsRawEdge, type RawNode as UtilsRawNode } from "./network_classes"

import CustomBezierEdge from './CustomBezierEdge'
import NodeWithHandles from './NodeWithHandles'
import { type FlowNodeData } from './network_classes'

import 'reactflow/dist/style.css'
import './flowStyles.css'
import './App.css'

const { Title } = Typography

const nodeTypes = { custom: NodeWithHandles }
const edgeTypes = { customBezier: CustomBezierEdge }

export default function App() {
  // graph starts empty, loaded via import
  const [graph, setGraph] = useState<GraphData | null>(null)
  const [details, setDetails] = useState<Record<string, unknown> | null>(null)
  const [form] = Form.useForm()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // derive raw nodes/edges or empty
  const rawNodes = useMemo<UtilsRawNode[]>(() => graph?.graph.nodes ?? [], [graph])
  const rawEdges = useMemo<UtilsRawEdge[]>(() => graph?.graph.edges ?? [], [graph])

  const echelons = useMemo(
    () => graph ? ([...graph.echelons.backwards].reverse()) : [],
    [graph]
  )
  
  const echelonMap = useMemo(() => buildEchelonMap(echelons), [echelons])
  
  const positions = useMemo(
    () => computeEchelonPositions(echelons, rawNodes),
    [echelons, rawNodes]
  )

  const initialNodes = useMemo<RFNode<FlowNodeData>[]>(() =>
    rawNodes.map((n) => ({
      id: n.id,
      type: 'custom',
      data: { label: n.id, obj: n.obj },
      position: positions[n.id] ?? { x: 0, y: 0 },
      className: `node--${n.obj.node_type}`,
      style: { opacity: 1 },
    })),
    [rawNodes, positions]
  )

  const initialEdges = useMemo<RFEdge[]>(() =>
    rawEdges.map((e) => {
      const down = echelonMap[e.source] < echelonMap[e.target]
      return {
        id: e.key,
        source: e.source,
        target: e.target,
        type: 'customBezier',
        sourceHandle: down ? 'source-bottom' : 'source-top',
        targetHandle: down ? 'target-top' : 'target-bottom',
        data: { offset: 0, obj: e.obj },
        markerEnd: { type: MarkerType.ArrowClosed },
        className: `edge--${e.obj.edge_type}`,
        style: { strokeWidth: 2, opacity: 1 },
      }
    }),
    [rawEdges, echelonMap]
  )

  const [nodes, setNodes] = useState<RFNode<FlowNodeData>[]>([])
  const [edges, setEdges] = useState<RFEdge[]>([])

  // whenever graph changes, reset nodes/edges state
  useMemo(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
    setDetails(null)
  }, [initialNodes, initialEdges])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  )
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  )
  const onConnect = useCallback(
    (conn: Connection) => setEdges((eds) => addEdge(conn, eds)),
    []
  )

  const resetSelection = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, style: { ...n.style, opacity: 1 } })))
    setEdges((eds) => eds.map((e) => ({ ...e, style: { ...e.style, opacity: 1 } })))
    setDetails(null)
  }, [])

  const onElementClick = useCallback(
    (_: React.MouseEvent, el: RFNode<FlowNodeData> | RFEdge) => {
      const isEdge = (el as RFEdge).source !== undefined
      const nodeSet = new Set<string>()
      const edgeSet = new Set<string>()
      if (isEdge) {
        edgeSet.add(el.id)
        nodeSet.add((el as RFEdge).source)
        nodeSet.add((el as RFEdge).target)
      } else {
        nodeSet.add(el.id)
        edges.forEach((ed) => {
          if (ed.source === el.id) { nodeSet.add(ed.target); edgeSet.add(ed.id) }
          if (ed.target === el.id) { nodeSet.add(ed.source); edgeSet.add(ed.id) }
        })
      }
      setNodes((nds) => nds.map((n) => ({
        ...n,
        style: { ...n.style, opacity: nodeSet.has(n.id) ? 1 : 0.1 }
      })))
      setEdges((eds) => eds.map((e) => ({
        ...e,
        style: { ...e.style, opacity: edgeSet.has(e.id) ? 1 : 0.05 }
      })))
      const obj = isEdge ? (el as RFEdge).data.obj : (el as RFNode<FlowNodeData>).data.obj
      setDetails(obj)
      form.setFieldsValue(roundNumbers(obj))
    }, [edges, form]
  )

  const onFormChange = useCallback(
    (_: Record<string, unknown>, all: Record<string, unknown>) => setDetails(roundNumbers(all)),
    []
  )

  const exportJson = useCallback(() => {
    if (!graph) return
    const out = {
      graph: {
        nodes: nodes.map((n) => ({ id: n.id, obj: roundNumbers(n.data.obj) })),
        edges: edges.map((e) => ({ key: e.id, source: e.source, target: e.target, obj: e.data.obj }))
      },
      echelons: graph.echelons,
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'export.json'; link.click()
  }, [nodes, edges, graph])

  // import handler
  const onImportClick = () => fileInputRef.current?.click()
  const onFileChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string)
        setGraph(json)
      } catch {
        Modal.error({ title: 'Import error', content: 'Invalid JSON file.' })
      }
    }
    reader.readAsText(file)
    evt.target.value = ''
  }

return (
    <div className="app-container">
      <div className="controls" style={{ padding: 8, display: 'flex', gap: 8 }}>
        <Button onClick={onImportClick}>Import JSON</Button>
        <input
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={onFileChange}
        />
        <Button type="primary" onClick={exportJson} disabled={!graph}>Export JSON</Button>
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
            style={{ width: '100%', height: 'calc(100vh - 48px)' }}
          />
        </div>
      </ReactFlowProvider>

      <div className="sidebar" style={{ resize: 'both', overflow: 'auto' }}>
        <div className="sidebar-header" style={{ marginBottom: 8 }}>
          <Title level={5}>Details</Title>
        </div>
        <Form form={form} layout="vertical" onValuesChange={onFormChange}>
          {details
            ? Object.entries(details).map(([key]) => (
                <Form.Item key={key} name={key} label={key}>
                  <Input />
                </Form.Item>
              ))
            : <div>Select a node or edge</div>}
        </Form>
      </div>
    </div>
  )
}
