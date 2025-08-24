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
