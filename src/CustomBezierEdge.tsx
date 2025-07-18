import React from "react";
import { getBezierPath, type EdgeProps } from "reactflow";
import { buildPrimitiveSummary } from "./utils";
import type { FlowEdgeData } from "./network_classes";

const CustomBezierEdge: React.FC<EdgeProps<FlowEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  style,
  data,
}) => {
  if (!data) {
    // Edge data has to exist for this application to work
    throw new Error(`Invariant violation: edge '${id}' rendered without data`);
  }

  const offset = data?.offset ?? 0;
  const summary = buildPrimitiveSummary(data.obj, { maxPairs: 12 });

  const [edgePath] = getBezierPath({
    sourceX: sourceX + offset,
    sourceY,
    sourcePosition,
    targetX: targetX + offset,
    targetY,
    targetPosition,
    curvature: 0.5,
  });

  return (
    <g className="react-flow__edge">
      <title>{summary}</title>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={style}
      />
    </g>
  );
};

export default CustomBezierEdge;
