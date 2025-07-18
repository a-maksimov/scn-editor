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
  /**
   * ВСЕ ХУКИ – ПЕРЕД ЛЮБЫМИ УСЛОВНЫМИ RETURN.
   * НЕТ ни одного `return` выше.
   */
  const [open, setOpen] = useState(
    depth === 0 ? true : !collapsedByDefault ? true : false
  );

  // Подготавливаем “детей” заранее – хук всегда вызывается.
  const objectEntries = useMemo<[string, JSONValue][]>(
    () => (isObject(value) ? Object.entries(value) : []),
    [value]
  );
  const arrayItems = useMemo<JSONValue[]>(
    () => (Array.isArray(value) ? value : []),
    [value]
  );

  const toggle = useCallback(() => setOpen((o) => !o), []);

  // Далее — просто ветвления от уже подготовленных данных (хуков больше нет).

  // Примитив
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

  // Массив
  if (Array.isArray(value)) {
    return (
      <div className="jt-branch">
        <div className="jt-header" onClick={toggle}>
          <span className="jt-caret">{open ? "▼" : "▶"}</span>
          <span className="jt-key">
            [Array] <span className="jt-faint">({arrayItems.length})</span>
          </span>
        </div>
        {open && (
          <div className="jt-children">
            {arrayItems.map((item, idx) => (
              <div key={idx} className="jt-node">
                <div className="jt-key">[{idx}]</div>
                <JsonTree
                  value={item}
                  path={[...path, idx]}
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
  }

  // Объект
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
