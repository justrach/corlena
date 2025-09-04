import { SvelteComponentTyped } from 'svelte';

export interface DrawingCanvasProps {
  width?: number;
  height?: number;
  brushColor?: string;
  brushWidth?: number;
  onPathComplete?: (pathId: number) => void;
  onPathStart?: (pathId: number) => void;
  style?: Record<string, string>;
  className?: string;
}

export default class DrawingCanvas extends SvelteComponentTyped<DrawingCanvasProps> {
  clearPaths(): void;
}
