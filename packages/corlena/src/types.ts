export type Axis = 'x' | 'y' | 'both';

export interface DraggableOptions {
  axis?: Axis;
  grid?: [number, number];
  // Visual scale factor applied to the dragged element/container (e.g. CSS zoom or transform: scale)
  // Used to compensate pointer deltas so dragging feels precise under scaling. Default: 1.
  scale?: number;
  bounds?: 'parent' | { left: number; top: number; right: number; bottom: number };
  inertia?: boolean;
  lockScroll?: boolean;
  useWasm?: boolean;
}

export interface DragEventDetail {
  x: number;
  y: number;
  dx: number;
  dy: number;
  velocity?: { x: number; y: number };
  source: 'pointer' | 'keyboard';
  modifiers?: { alt: boolean; shift: boolean; meta: boolean; ctrl: boolean };
}

export interface GestureState {
  activeId: string | null;
  isDragging: boolean;
  isResizing: boolean;
  pointers: Record<number, { x: number; y: number; pressure?: number }>;
  zoom: number;
  velocity: { x: number; y: number };
}

export interface GlobalConfig {
  passive?: boolean;
  defaultCursor?: string | null;
  rafStrategy?: 'auto' | 'single' | 'double';
  pixelRatioAware?: boolean;
  ios?: { lockGestureZoom?: 'during' | 'never' | 'always'; doubleTapGuard?: boolean };
}

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface ResizableOptions {
  edges?: 'all' | ResizeEdge[];
  min?: [number, number];
  max?: [number, number] | null;
  aspect?: boolean; // maintain aspect ratio
  lockScroll?: boolean;
}

export interface ResizeEventDetail {
  width: number;
  height: number;
  dw: number;
  dh: number;
  edge: ResizeEdge;
}
