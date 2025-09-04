import * as React from 'react';

export type Point = { x: number; y: number };
export type Size = { w: number; h: number };

export function useDraggable(options?: {
  initial?: Point;
  onMove?: (pos: Point) => void;
  lockScroll?: boolean;
}): {
  x: number;
  y: number;
  set: React.Dispatch<React.SetStateAction<Point>>;
  bind: {
    onPointerDown: React.PointerEventHandler<HTMLElement>;
    onPointerMove: React.PointerEventHandler<HTMLElement>;
    onPointerUp: React.PointerEventHandler<HTMLElement>;
    style?: React.CSSProperties;
  };
};

export function Draggable(props: {
  children?: React.ReactNode | ((state: { x: number; y: number }) => React.ReactNode);
  initial?: Point;
  onMove?: (pos: Point) => void;
  style?: React.CSSProperties;
  className?: string;
}): React.JSX.Element;

export function useResizable(options?: {
  initial?: Size;
  onResize?: (size: Size) => void;
  lockScroll?: boolean;
}): {
  w: number;
  h: number;
  set: React.Dispatch<React.SetStateAction<Size>>;
  handleProps: {
    onPointerDown: React.PointerEventHandler<HTMLElement>;
    onPointerMove: React.PointerEventHandler<HTMLElement>;
    style?: React.CSSProperties;
  };
};

export function Resizable(props: {
  children?: React.ReactNode | ((state: { w: number; h: number }) => React.ReactNode);
  initial?: Size;
  onResize?: (size: Size) => void;
  style?: React.CSSProperties;
  className?: string;
}): React.JSX.Element;

// Overlay types
export type Transform = { x: number; y: number; angle: number; sx: number; sy: number };
export type DomNodeHandlers = {
  onTap?: (id: number) => void;
  onDoubleTap?: (id: number) => void;
  onDragStart?: (id: number) => void;
  onDragEnd?: (id: number) => void;
};
export type SceneContextValue = {
  ready: boolean;
  upsertNode: (node: { id: number; x?: number; y?: number; w?: number; h?: number; vx?: number; vy?: number; flags?: number }) => void;
  registerHandlers: (id: number, handlers?: DomNodeHandlers) => void | (() => void);
  applyPointer: (id: number, x: number, y: number, buttons: number) => void;
  getTransform: (id: number) => Transform | null;
  layerRef: React.RefObject<HTMLDivElement>;
  toLocal: (clientX: number, clientY: number) => { x: number; y: number };
};

export function useScene(): SceneContextValue;
export function SceneProvider(props: {
  children?: React.ReactNode | ((context: { ready: boolean }) => React.ReactNode);
  tapParams?: Float32Array | number[];
  capacity?: number;
}): React.JSX.Element;

export function DomLayer(props: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}): React.JSX.Element;

export function DomNode(props: {
  id: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
} & DomNodeHandlers): React.JSX.Element;

export function DrawingCanvas(props: {
  width?: number;
  height?: number;
  brushColor?: string;
  brushWidth?: number;
  onPathComplete?: (pathId: number) => void;
  onPathStart?: (pathId: number) => void;
  style?: React.CSSProperties;
  className?: string;
}): React.JSX.Element;
