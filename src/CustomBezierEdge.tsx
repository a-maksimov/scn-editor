import React from 'react'
import { getBezierPath, type EdgeProps } from 'reactflow'

const CustomBezierEdge: React.FC<EdgeProps> = (props) => {
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
  } = props

  // grab offset if present, default to 0
  const offset = (data as any)?.offset ?? 0

  // shift only the X controls by offset
  const [edgePath] = getBezierPath({
    sourceX: sourceX + offset,
    sourceY,
    sourcePosition,
    targetX: targetX + offset,
    targetY,
    targetPosition,
    curvature: 0.5,
  })

  return (
    <g className="react-flow__edge">
      <title>{(data as any).obj.tooltip}</title>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={style}
      />
    </g>
  )
}

export default CustomBezierEdge
