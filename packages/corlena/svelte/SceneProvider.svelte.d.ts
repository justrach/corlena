import { SvelteComponentTyped } from 'svelte';

export interface SceneProviderProps {
  tapParams?: [number, number, number, number];
  capacity?: number;
}

export interface SceneProviderSlots {
  default: { ready: boolean };
}

export default class SceneProvider extends SvelteComponentTyped<SceneProviderProps, {}, SceneProviderSlots> {}
