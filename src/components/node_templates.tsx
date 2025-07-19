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
  propagated_demand: null,
  reorder_point: null,
  order_size: null,
  cycle_stock: null,
  average_cycle_stock: null,
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
