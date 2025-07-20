import { type Edge as RFEdge, type Node as RFNode } from "reactflow";
import { FlowEdgeData, FlowNodeData } from "./network_classes";

type NodeType =
  | "procurement"
  | "production"
  | "stock"
  | "stock_no_storage"
  | "distributor"
  | "sale";

export function getNodeType(
  nodes: RFNode<FlowNodeData>[],
  id: string
): NodeType | undefined {
  return nodes.find((n) => n.id === id)?.data.obj.node_type as
    | NodeType
    | undefined;
}

const ALLOWED: Record<NodeType, Set<NodeType>> = {
  procurement: new Set(["stock", "stock_no_storage"]),
  production: new Set(["stock", "stock_no_storage", "sale"]),
  stock: new Set(["stock", "stock_no_storage", "production", "sale"]),
  stock_no_storage: new Set([
    "stock",
    "stock_no_storage",
    "production",
    "sale",
  ]),
  distributor: new Set(["sale"]),
  sale: new Set([]),
};

export function isPairAllowed(srcType?: NodeType, tgtType?: NodeType): boolean {
  if (!srcType || !tgtType) return false;
  if (tgtType === "procurement") return false;
  if (srcType === "sale") return false;
  const set = ALLOWED[srcType];
  return set?.has(tgtType) ?? false;
}

export function resolveEdgeType(
  srcType: NodeType,
  tgtType: NodeType,
  userChosen: string
): string {
  // 0. Movement
  if (
    (tgtType === "stock" || tgtType === "stock_no_storage") &&
    (srcType === "stock" || srcType === "stock_no_storage")
  )
    return "movement";

  // 1. BOM: stock family -> production
  if (
    tgtType === "production" &&
    (srcType === "stock" || srcType === "stock_no_storage")
  )
    return "bom";

  // 2. Source procurement -> supply
  if (srcType === "procurement") return "supply";

  // 3. Source production -> supply
  if (srcType === "production") return "supply";

  // 4. Target sale -> supply
  if (tgtType === "sale") return "supply";

  // 5. Neutral cases
  if (userChosen === "movement" || userChosen === "undefined")
    return userChosen;
  if (userChosen === "supply") return "supply";
  if (userChosen === "bom") {
    // Valid bom is (1); ignore
  }

  // 6. Fallback
  return "undefined";
}
export const KEY_CONFIG = {
  production: {
    fields: ["bomnum", "product", "location"],
    build: (v: Record<string, string>) =>
      `ProductionNetworkKey(bomnum='${v.bomnum}', location='${v.location}', product='${v.product}')`,
  },
  procurement: {
    fields: ["location", "product"],
    build: (v) =>
      `ProcurementNetworkKey(location='${v.location}', product='${v.product}')`,
  },
  sale: {
    fields: ["client", "location", "product"],
    build: (v) =>
      `SaleNetworkKey(client='${v.client}', location='${v.location}', product='${v.product}')`,
  },
  stock: {
    fields: ["location", "product"],
    build: (v) =>
      `StockNetworkKey(location='${v.location}', product='${v.product}')`,
  },
  stock_no_storage: {
    fields: ["location", "product"],
    build: (v) =>
      `StockNetworkKey(location='${v.location}', product='${v.product}')`,
  },
  distributor: {
    fields: ["location", "product"],
    build: (v) =>
      `StockNetworkKey(location='${v.location}', product='${v.product}')`,
  },
  undefined: {
    fields: ["location", "product"],
    build: (v) =>
      `NetworkKey(location='${v.location}', product='${v.product}')`,
  },
} as const;

export function hasMaxOutEdge(
  nodeId: string,
  nodeType: string,
  edges: RFEdge<FlowEdgeData>[]
): boolean {
  if (nodeType !== "production" && nodeType !== "procurement") return false;
  return edges.some((e) => e.source === nodeId);
}
