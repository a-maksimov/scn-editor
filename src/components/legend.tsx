// Legend.tsx
import React, { useState } from "react";
import { NODE_TEMPLATES } from "./node_templates";
import { EDGE_TEMPLATES } from "./edge_templates";

import "../legend.css";

export const Legend: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`legend legend--floating ${collapsed ? "is-collapsed" : ""}`}
    >
      <div className="legend__header" onClick={() => setCollapsed((c) => !c)}>
        <span>Legend</span>
        <button
          type="button"
          className="legend__toggle"
          aria-label={collapsed ? "Expand legend" : "Collapse legend"}
        >
          {collapsed ? "▸" : "▾"}
        </button>
      </div>
      {!collapsed && (
        <div className="legend__body">
          <div className="legend__section">
            <div className="legend__section-title">Nodes</div>
            <div className="legend__nodes">
              {NODE_TEMPLATES.map((t) => (
                <div key={t.node_type} className="legend__row">
                  <div
                    className={`legend-node-swatch node--${t.node_type}`}
                    title={t.node_type}
                  />
                  <div className="legend__label">{t.node_type}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="legend__section">
            <div className="legend__section-title">Edges</div>
            <div className="legend__edges">
              {EDGE_TEMPLATES.map((t) => (
                <div key={t.edge_type} className="legend__row">
                  <svg
                    className="legend-edge-swatch"
                    viewBox="0 0 60 16"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <defs>
                      {/* Маркер стрелки – без дублирования стилей, цвет унаследуем через currentColor */}
                      <marker
                        id={`lg-arrow-${t.edge_type}`}
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                      >
                        <polygon points="0 0, 10 5, 0 10" />
                      </marker>
                    </defs>
                    <path
                      className={`legend-edge-path edge--${t.edge_type}`}
                      d="M4 12 C20 2, 40 2, 56 12"
                      fill="none"
                      markerEnd={`url(#lg-arrow-${t.edge_type})`}
                    />
                  </svg>
                  <div className="legend__label">{t.edge_type}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
