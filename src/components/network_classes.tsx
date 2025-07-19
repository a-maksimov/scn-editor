// Raw data from JSON
export interface RawNode {
  id: string;
  obj: { node_type: string; [key: string]: unknown };
}

export interface RawEdge {
  key: string;
  source: string;
  target: string;
  obj: { edge_type: string; [key: string]: unknown };
}

export interface GraphData {
  graph: {
    nodes: RawNode[];
    edges: RawEdge[];
  };
  echelons: {
    forward: string[][];
    backwards: string[][];
  };
}

// Domain objects (fields after parsing)
export interface SupplyNodeObject {
  node_type: string;

  network_key?: string;
  entity?: string;
  policy?: string;
  has_storage?: boolean;
  lead_time?: number;
  lead_time_var?: number;
  order_calendar?: unknown[];
  streams?: unknown[];
  pools?: unknown[];
  propagated_lead_time?: number;
  propagated_lead_time_var?: number;
  propagated_demand?: number | null;
  reorder_point?: number | null;
  order_size?: number | null;
  cycle_stock?: number | null;
  average_cycle_stock?: number | null;
  propagated_min_lot_size?: number;
  propagated_lot_multiplier?: number;
  node_lot_size?: number;

  [key: string]: unknown;
}

export interface SupplyEdgeObject {
  edge_type: string;

  network_key_from?: string;
  network_key_to?: string;
  network_key?: string;

  entity?: string | null;

  lead_time?: number;
  lead_time_var?: number;
  keep_upstream?: boolean;
  quota?: number;

  streams?: unknown[];

  propagated_lead_time?: number;
  propagated_lead_time_var?: number;
  propagated_demand?: number | null;
  propagated_min_lot_size?: number;
  propagated_lot_multiplier?: number;

  min_lot_size?: number | null;
  lot_multiplier?: number | null;

  [key: string]: unknown;
}

// Data for React Flow (payload, to put in node.data and edge.data)
export interface FlowNodeData {
  label: string;
  obj: SupplyNodeObject;
}

export interface FlowEdgeData {
  obj: SupplyEdgeObject;
  offset?: number;
}
