export const DEFAULT_PRECISION: number = 2

export type EchelonMap = Record<string, number>

export interface RawNode {
  id: string
  obj: { node_type: string;[key: string]: unknown} 
}

export interface RawEdge {
  key: string
  source: string
  target: string
  obj: { edge_type: string;[key: string]: unknown} 
}

export interface GraphData {
  graph: {
    nodes: RawNode[]
    edges: RawEdge[]
  }
  echelons: {
    forwards: string[][]
    backwards: string[][]
  }
}

export function buildEchelonMap(echelons: string[][]): EchelonMap {
  const map: EchelonMap = {}
  echelons.forEach((grp, i) => grp.forEach((id) => (map[id] = i)))
  return map
}

export function computeEchelonPositions(
  echelons: string[][],
  nodes: RawNode[],
  { echelonSpacing = 150, baseSpacing = 200 } = {}): Record<string, { x: number; y: number} > {
  const ids = new Set(nodes.map((n) => n.id))
  const positions: Record<string, { x: number; y: number} > = {}

  echelons.forEach((grp, row) => {
    const rowIds = grp.filter((id) => ids.has(id))
    if (!rowIds.length) return
    const y = row * echelonSpacing
    const spacing = baseSpacing * Math.max(1, 10 / rowIds.length)
    const offset = ((rowIds.length - 1) * spacing) / 2
    rowIds.forEach((id, i) => {
      positions[id] = { x: i * spacing - offset, y }
    })
  })

  return positions
}

export interface FlowNodeData {
  label: string
  obj: { node_type: string; date?: string; tooltip?: string} 
}

/**
 * Recursively rounds all numeric values in an object/array to the nearest integer.
 * Works on any JSON‑serializable structure.
 */
export function roundNumbers<T>(data: T, precision: number = DEFAULT_PRECISION): T {
  const factor = 10 ** precision

  if (typeof data === 'number') {
    // Round a number
    return (Math.round(data * factor) / factor) as T
  }

  if (Array.isArray(data)) {
    // Recurse into each element of the array
    return data.map((item) => roundNumbers(item)) as T
  }

  if (data !== null && typeof data === 'object') {
    // Build up a new object, preserving keys
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = roundNumbers(value as any)
    }
    return result as T
  }

  // Primitives other than number (string, boolean, null, undefined)
  return data
}
