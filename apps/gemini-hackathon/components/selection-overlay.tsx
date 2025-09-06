'use client'

import { LayerTransform } from '@/lib/canvas-interactions'

interface SelectionOverlayProps {
  transform: LayerTransform
  isSelected: boolean
  onResizeHandleMouseDown?: (handle: string, e: React.MouseEvent) => void
}

export function SelectionOverlay({ transform, isSelected, onResizeHandleMouseDown }: SelectionOverlayProps) {
  if (!isSelected) return null

  const { x, y, width, height } = transform
  const handleSize = 8

  const handles = [
    { type: 'nw', x: x - handleSize/2, y: y - handleSize/2 },
    { type: 'n', x: x + width/2 - handleSize/2, y: y - handleSize/2 },
    { type: 'ne', x: x + width - handleSize/2, y: y - handleSize/2 },
    { type: 'e', x: x + width - handleSize/2, y: y + height/2 - handleSize/2 },
    { type: 'se', x: x + width - handleSize/2, y: y + height - handleSize/2 },
    { type: 's', x: x + width/2 - handleSize/2, y: y + height - handleSize/2 },
    { type: 'sw', x: x - handleSize/2, y: y + height - handleSize/2 },
    { type: 'w', x: x - handleSize/2, y: y + height/2 - handleSize/2 },
  ]

  return (
    <g>
      {/* Selection border */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke="#ff6b35"
        strokeWidth="3"
        pointerEvents="none"
      />
      
      {/* Resize handles */}
      {handles.map(({ type, x: hx, y: hy }) => (
        <rect
          key={type}
          x={hx}
          y={hy}
          width={handleSize}
          height={handleSize}
          fill="#ff6b35"
          stroke="white"
          strokeWidth="1"
          className="cursor-pointer"
          style={{ cursor: `${type}-resize` }}
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onResizeHandleMouseDown?.(type, e)
          }}
        />
      ))}
      
      {/* Label */}
      <text
        x={x}
        y={y - 8}
        fill="#ff6b35"
        fontSize="12"
        fontFamily="Arial"
        pointerEvents="none"
      >
        SELECTED FOR EDIT
      </text>
    </g>
  )
}
