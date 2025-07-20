// node_templates.tsx
import type { SupplyNodeObject } from "./network_classes";

export interface NodeTemplate {
  node_type: string;
  defaultObj: SupplyNodeObject;
  labelBuilder?: (o: SupplyNodeObject) => string;
}

/**
 * Общие дефолты для числовых полей: 0 / 0.0, для *_demand / *_stock / *_point: null
 * order_calendar, streams, pools: пустые массивы.
 * policy выбрал:
 *   - stock: "divide" (как в твоём JSON, кроме некоторых pool – можешь скорректировать позже)
 *   - production / procurement / sale: "divide"
 *   - undefined: "divide"
 *   - stock (pool-варианты) можешь потом переключать вручную.
 */
const baseNodeDefaults: Omit<SupplyNodeObject, "node_type"> = {
  network_key: undefined,
  entity: undefined,
  policy: "divide",
  has_storage: false,
  lead_time: 0,
  lead_time_var: 0,
  order_calendar: [],
  streams: [],
  pools: [],
  propagated_lead_time: 0,
  propagated_lead_time_var: 0,
  propagated_demand: [],
  reorder_point: [],
  order_size: [],
  cycle_stock: [],
  average_cycle_stock: [],
  propagated_min_lot_size: 0,
  propagated_lot_multiplier: 0,
  node_lot_size: 0,
};

export const NODE_TEMPLATES: NodeTemplate[] = [
  {
    node_type: "sale",
    defaultObj: {
      node_type: "sale",
      ...baseNodeDefaults,
      entity: "sale",
      has_storage: false,
      policy: "divide",
      streams: [],
    },
  },
  {
    node_type: "stock",
    defaultObj: {
      node_type: "stock",
      ...baseNodeDefaults,
      entity: "stock",
      has_storage: true,
      policy: "divide",
    },
  },
  {
    node_type: "stock_no_storage",
    defaultObj: {
      node_type: "stock_no_storage",
      ...baseNodeDefaults,
      entity: "stock",
      has_storage: false,
      policy: "divide",
    },
  },
  {
    node_type: "production",
    defaultObj: {
      node_type: "production",
      ...baseNodeDefaults,
      entity: "production",
      has_storage: false,
      policy: "divide",
    },
  },
  {
    node_type: "procurement",
    defaultObj: {
      node_type: "procurement",
      ...baseNodeDefaults,
      entity: "procurement",
      has_storage: false,
      lead_time: 0,
      lead_time_var: 0,
      policy: "divide",
    },
  },
  {
    node_type: "distributor",
    defaultObj: {
      node_type: "distributor",
      ...baseNodeDefaults,
      entity: "stock",
      has_storage: true,
      policy: "divide",
    },
  },
  {
    node_type: "undefined",
    defaultObj: {
      node_type: "undefined",
      ...baseNodeDefaults,
      has_storage: false,
      policy: "divide",
    },
  },
];

export interface SaleStream {
  path: string[];
  demand_id: string;
  keep_upstream: boolean;
  independent_demand: boolean;
  _service_level: number | null;
  demand: {
    __metric_array__: true;
    data: number[];
    tails: [number, number];
    dtype: string;
  };
  demand_var: {
    __metric_array__: true;
    data: number[];
    tails: [number, number];
    dtype: string;
  };
  backlog: number[];
  backlog_var: number[];
  safety_stock_demand: number[];
  safety_stock_supply: number[];
  safety_stock_service: number[];
  safety_stock: number[];
  propagated_demand: number[];
}

export function buildInitialSaleStream(
  networkKey: string,
  values: Record<string, string>
): SaleStream {
  const { client, location, product } = values;
  const streamKey = `StreamKey(client='${client}', location='${location}', product='${product}')`;
  return {
    path: [networkKey],
    demand_id: streamKey,
    keep_upstream: true,
    independent_demand: true,
    _service_level: null,
    demand: {
      __metric_array__: true,
      data: [100, 100, 100, 100, 100, 100, 100, 100, 100],
      tails: [0, 9],
      dtype: "float64",
    },
    demand_var: {
      __metric_array__: true,
      data: [10, 10, 10, 10, 10, 10, 10, 10, 10],
      tails: [0, 9],
      dtype: "float64",
    },
    backlog: [],
    backlog_var: [],
    safety_stock_demand: [],
    safety_stock_supply: [],
    safety_stock_service: [],
    safety_stock: [],
    propagated_demand: [],
  };
}
