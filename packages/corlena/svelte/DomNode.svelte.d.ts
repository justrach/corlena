import { SvelteComponentTyped } from 'svelte';

export interface DomNodeProps {
  id: number;
  style?: Record<string, any>;
  onTap?: (nodeId: number) => void;
  onDragStart?: (nodeId: number) => void;
  onDragEnd?: (nodeId: number) => void;
}

export interface DomNodeSlots {
  default: {};
}

export default class DomNode extends SvelteComponentTyped<DomNodeProps, {}, DomNodeSlots> {}
