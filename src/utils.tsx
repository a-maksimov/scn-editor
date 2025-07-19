import type { JSONObject, JSONValue } from "./components/json-types";
import type {
  RawNode,
  SupplyEdgeObject,
  SupplyNodeObject,
} from "./components/network_classes";

export const DEFAULT_PRECISION: number = 2;

export type EchelonMap = Record<string, number>;

export function buildEchelonMap(echelons: string[][]): EchelonMap {
  const map: EchelonMap = {};
  echelons.forEach((grp, i) => grp.forEach((id) => (map[id] = i)));
  return map;
}

export function computeEchelonPositions(
  echelons: string[][],
  nodes: RawNode[],
  { echelonSpacing = 150, baseSpacing = 200 } = {}
): Record<string, { x: number; y: number }> {
  const ids = new Set(nodes.map((n) => n.id));
  const positions: Record<string, { x: number; y: number }> = {};

  echelons.forEach((grp, row) => {
    const rowIds = grp.filter((id) => ids.has(id));
    if (!rowIds.length) return;
    const y = row * echelonSpacing;
    const spacing = baseSpacing * Math.max(1, 10 / rowIds.length);
    const offset = ((rowIds.length - 1) * spacing) / 2;
    rowIds.forEach((id, i) => {
      positions[id] = { x: i * spacing - offset, y };
    });
  });

  return positions;
}

/**
 * Recursively rounds all numeric values in an object/array to the nearest integer.
 * Works on any JSON‑serializable structure.
 */
export function roundNumbers<T>(
  data: T,
  precision: number = DEFAULT_PRECISION
): T {
  const factor = 10 ** precision;

  if (typeof data === "number") {
    // Round a number
    return (Math.round(data * factor) / factor) as T;
  }

  if (Array.isArray(data)) {
    // Recurse into each element of the array
    return data.map((item) => roundNumbers(item)) as T;
  }

  if (data !== null && typeof data === "object") {
    // Build up a new object, preserving keys
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>
    )) {
      result[key] = roundNumbers(value as any);
    }
    return result as T;
  }

  // Primitives other than number (string, boolean, null, undefined)
  return data;
}

interface PrimitiveSummaryOptions {
  maxPairs?: number;
  precision?: number;
  trimZeros?: boolean;
}

export function buildPrimitiveSummary(
  record: Record<string, unknown>,
  {
    maxPairs,
    precision = DEFAULT_PRECISION,
    trimZeros = false,
  }: PrimitiveSummaryOptions = {}
): string {
  const primitive = (v: unknown) =>
    v === null || ["string", "number", "boolean"].includes(typeof v);

  let entries = Object.entries(record).filter(([, v]) => primitive(v));

  if (typeof maxPairs === "number") {
    entries = entries.slice(0, maxPairs);
  }

  return entries
    .map(([k, v]) => {
      if (typeof v === "number" && typeof precision === "number") {
        const rounded = roundNumbers(v, precision);
        let formatted = String(rounded);
        if (trimZeros && precision > 0) {
          formatted = formatted.replace(/\.?0+$/, "");
        }
        return `${k}: ${formatted}`;
      }
      return `${k}: ${v}`;
    })
    .join(", ");
}

// JSON-Tree helpers
export function sanitizeToJSONValue<T extends object>(obj: T): JSONValue {
  if (obj === null) return null;
  if (Array.isArray(obj)) {
    return obj.map((v) => sanitizeToJSONValue(v as any));
  }
  if (typeof obj === "object") {
    const out: Record<string, JSONValue> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === null || ["string", "number", "boolean"].includes(typeof v)) {
        out[k] = v as JSONValue;
      } else if (Array.isArray(v)) {
        out[k] = v.map((x) => sanitizeToJSONValue(x as any)) as JSONValue;
      } else if (typeof v === "object") {
        out[k] = sanitizeToJSONValue(v as any);
      } else {
        // skip functions / undefined / symbols
      }
    }
    return out;
  }
  // primitives
  return obj as unknown as JSONValue;
}

export function updateJsonAtPath(
  root: JSONValue,
  path: (string | number)[],
  nextValue: JSONValue
): JSONValue {
  if (path.length === 0) return nextValue;
  const [head, ...rest] = path;

  if (Array.isArray(root)) {
    const copy = [...root];
    const idx = head as number;
    copy[idx] = updateJsonAtPath(copy[idx], rest, nextValue);
    return copy;
  }
  if (root !== null && typeof root === "object") {
    const obj = root as JSONObject;
    const copy: JSONObject = { ...obj };
    copy[head as string] = updateJsonAtPath(
      copy[head as string],
      rest,
      nextValue
    );
    return copy;
  }
  return nextValue;
}

export function isSupplyNodeObject(obj: unknown): obj is SupplyNodeObject {
  return !!obj && typeof obj === "object" && "node_type" in (obj as any);
}

export function isSupplyEdgeObject(obj: unknown): obj is SupplyEdgeObject {
  return !!obj && typeof obj === "object" && "edge_type" in (obj as any);
}

export function deriveNodeLabel(nodeObj: SupplyNodeObject): string {
  return nodeObj.network_key ?? nodeObj.node_type;
}
