// src/NodeWithHandles.tsx
import { Handle, Position, type NodeProps } from 'reactflow'
import { Tooltip } from 'antd'
import type { FlowNodeData } from './utils'

export function NodeWithHandles({ data, isConnectable }: NodeProps<FlowNodeData>) {
  return (
    <Tooltip title={data.obj.tooltip}>
      <div className="custom-node-wrapper">
        {/* Shape container with handles */}
        <div className={`custom-node-shape node--${data.obj.node_type}`}>
          <Handle
            type="target"
            position={Position.Top}
            id="target-top"
            style={{ left: '50%' }}
            isConnectable={isConnectable}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="source-bottom"
            style={{ left: '50%' }}
            isConnectable={isConnectable}
          />
        </div>

        {/* Label beneath the node shape */}
        <div className="custom-node-label">
          [{data.obj.node_type}] ({data.label})
        </div>
      </div>
    </Tooltip>
  )
}

export default NodeWithHandles
