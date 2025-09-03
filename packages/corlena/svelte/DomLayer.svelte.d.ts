import { SvelteComponentTyped } from 'svelte';

export interface DomLayerProps {}

export interface DomLayerSlots {
  default: {};
}

export default class DomLayer extends SvelteComponentTyped<DomLayerProps, {}, DomLayerSlots> {}
