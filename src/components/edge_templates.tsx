// edge_templates.ts
import type { SupplyEdgeObject } from "./network_classes";

export interface EdgeTemplate {
  edge_type: string;
  defaultObj: SupplyEdgeObject;
}

/**
 * Общие дефолты для ребра:
 *   lead_time / lead_time_var как в примерах (movement: 1 / 0.04 или 0.01; остальные 0)
 *   keep_upstream: true (как в JSON)
 *   quota: 1.0 (или массив единиц – пока ставлю 1.0; при необходимости можешь заменить)
 *   min_lot_size / lot_multiplier: null
 *   streams: []
 *   propagated_*: 0 / null
 */
const baseEdgeDefaults: Omit<SupplyEdgeObject, "edge_type"> = {
  network_key_from: undefined,
  network_key_to: undefined,
  network_key: undefined,
  entity: null,
  lead_time: 0,
  lead_time_var: 0,
  keep_upstream: true,
  quota: 1.0,
  streams: [],
  propagated_lead_time: 0,
  propagated_lead_time_var: 0,
  propagated_demand: null,
  propagated_min_lot_size: 0,
  propagated_lot_multiplier: 0,
  min_lot_size: null,
  lot_multiplier: null,
};

export const EDGE_TEMPLATES: EdgeTemplate[] = [
  {
    edge_type: "movement",
    defaultObj: {
      edge_type: "movement",
      ...baseEdgeDefaults,
      entity: "movement",
      lead_time: 0,
      lead_time_var: 0,
    },
  },
  {
    edge_type: "supply",
    defaultObj: {
      edge_type: "supply",
      ...baseEdgeDefaults,
      entity: null,
    },
  },
  {
    edge_type: "bom",
    defaultObj: {
      edge_type: "bom",
      ...baseEdgeDefaults,
      entity: null,
    },
  },
  {
    edge_type: "undefined",
    defaultObj: {
      edge_type: "undefined",
      ...baseEdgeDefaults,
      entity: null,
    },
  },
];
