import React from "react";
import { getBezierPath, type EdgeProps } from "reactflow";
import type { FlowEdgeData } from "./network_classes";
import { buildPrimitiveSummary } from "../utils";

const CustomBezierEdge: React.FC<EdgeProps<FlowEdgeData>> = (props) => {
  const {
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
  } = props;

  if (!data) {
    throw new Error(`Invariant violation: edge '${id}' rendered without data`);
  }

  const summary = buildPrimitiveSummary(data.obj, { maxPairs: 12 });

  const [edgePath] = getBezierPath({
    sourceX: sourceX,
    sourceY,
    sourcePosition,
    targetX: targetX,
    targetY,
    targetPosition,
    curvature: 0.5,
  });

  return (
    <>
      <title>{summary}</title>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={style}
      />
    </>
  );
};

export default CustomBezierEdge;
