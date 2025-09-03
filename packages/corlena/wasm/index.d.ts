export interface FrameOut {
  transforms: Float32Array;
  particles: Float32Array;
  /**
   * Events ring buffer with stride of 4 per event: [type, a, b, data]
   * Types:
   *  1 = drag_start (a=nodeId)
   *  2 = drag_end   (a=nodeId)
   * 10 = tap        (a=nodeId, b=1)
   * 11 = double_tap (a=nodeId, b=2)
   */
  events: Int32Array;
}
export function init(capacity?: number): Promise<void>;
export function reset(): void;
export function setView(scale: number): void;
export function setViewParams(scale: number, panX: number, panY: number, pixelRatio: number): void;
export function setConstraints(params: Float32Array): void;
export function upsertNodes(nodes: Float32Array): void;
export function applyPointers(pointers: Float32Array): void;
export function processFrame(input: { dt: number }): FrameOut;
export function isReady(): boolean;
export function storeImage(id: number, rgba: Uint8Array, w: number, h: number): boolean;
export function resizeImage(id: number, outW: number, outH: number): Uint8Array;
export function resizeImageMode(id: number, outW: number, outH: number, mode: number): Uint8Array;
// Particle APIs
export function spawnParticles(data: Float32Array | number[]): number;
export function clearParticles(): void;
export function setParticleParams(params: Float32Array | number[]): void;
/**
 * Configure tap detection parameters: [tap_max_s, move_thresh_px, double_s, single_delay_s]
 */
export function setTapParams(params: Float32Array | number[]): void;
