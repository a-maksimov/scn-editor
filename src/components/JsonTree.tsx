// src/components/JsonTree.tsx
import React, { useState, useMemo, useCallback } from "react";
import type { JSONObject, JSONPrimitive, JSONValue } from "./json-types";

interface JsonTreeProps {
  value: JSONValue;
  path?: (string | number)[];
  onChange?: (path: (string | number)[], next: JSONValue) => void;
  depth?: number;
  collapsedByDefault?: boolean;
}

const isPrimitive = (v: JSONValue): v is JSONPrimitive =>
  v === null || ["string", "number", "boolean"].includes(typeof v);

const isObject = (v: JSONValue): v is JSONObject =>
  v !== null && !Array.isArray(v) && typeof v === "object";

export const JsonTree: React.FC<JsonTreeProps> = ({
  value,
  path = [],
  onChange,
  depth = 0,
  collapsedByDefault = true,
}) => {
  const [open, setOpen] = useState(
    depth === 0 ? true : !collapsedByDefault ? true : false
  );

  const objectEntries = useMemo<[string, JSONValue][]>(
    () => (isObject(value) ? Object.entries(value) : []),
    [value]
  );

  const toggle = useCallback(() => setOpen((o) => !o), []);

  if (isPrimitive(value)) {
    const display = value === null ? "" : String(value);
    return (
      <div className="jt-row">
        <input
          className="jt-input"
          value={display}
          onChange={(e) => {
            const raw = e.target.value;
            let parsed: JSONValue = raw;
            if (raw === "") parsed = null;
            else if (/^-?\d+(\.\d+)?$/.test(raw)) parsed = Number(raw);
            else if (raw === "true") parsed = true;
            else if (raw === "false") parsed = false;
            onChange?.(path, parsed);
          }}
        />
        <span className="jt-type-tag">
          {value === null ? "null" : typeof value}
        </span>
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <details open>
        <summary className="jt-summary">
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            [Array] ({value.length})
            <button
              type="button"
              className="jt-btn"
              title="Add element"
              onClick={(e) => {
                e.stopPropagation();
                const defaultNewElement: JSONValue = (() => {
                  if (value.length > 0) {
                    const sample = value[0];
                    if (typeof sample === "number") return 0;
                    if (typeof sample === "string") return "";
                    if (typeof sample === "boolean") return false;
                    if (Array.isArray(sample)) return [];
                    if (sample && typeof sample === "object") return {};
                  }
                  return null;
                })();
                const newArr = [...value, defaultNewElement]; // <- меняй null на что хочешь по умолчанию
                onChange?.(path, newArr);
              }}
            >
              +
            </button>
          </span>
        </summary>
        <div className="jt-children">
          {value.map((item, idx) => (
            <div key={idx} className="jt-node">
              <div
                className="jt-key"
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                <span>[{idx}]</span>
                <button
                  type="button"
                  className="jt-btn jt-btn-remove"
                  title="Remove element"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newArr = value
                      .slice(0, idx)
                      .concat(value.slice(idx + 1));
                    onChange?.(path, newArr);
                  }}
                  style={{
                    fontSize: 10,
                    lineHeight: 1,
                    padding: "0 4px",
                    border: "1px solid #ccc",
                    background: "#fafafa",
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>
              <JsonTree
                value={item}
                path={[...path, idx]}
                onChange={onChange}
              />
            </div>
          ))}
        </div>
      </details>
    );
  }

  return (
    <div className="jt-branch">
      <div className="jt-header" onClick={toggle}>
        <span className="jt-caret">{open ? "▼" : "▶"}</span>
        <span className="jt-key">
          {depth === 0 ? "{root}" : "{Object}"}
          <span className="jt-faint"> ({objectEntries.length} keys)</span>
        </span>
      </div>
      {open && (
        <div className="jt-children">
          {objectEntries.map(([k, v]) => (
            <div key={k} className="jt-node">
              <div className="jt-key">{k}</div>
              <JsonTree
                value={v}
                path={[...path, k]}
                onChange={onChange}
                depth={depth + 1}
                collapsedByDefault={collapsedByDefault}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
