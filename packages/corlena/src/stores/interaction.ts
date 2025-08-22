import { writable } from 'svelte/store';
import type { GestureState } from '../types';

export function createGestureStore() {
  const { subscribe, update, set } = writable<GestureState>({
    activeId: null,
    isDragging: false,
    isResizing: false,
    pointers: {},
    zoom: 1,
    velocity: { x: 0, y: 0 }
  });
  return { subscribe, update, set };
}

export const interactionStore = createGestureStore;
