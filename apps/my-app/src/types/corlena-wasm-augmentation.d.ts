declare module 'corlena/wasm' {
  /** Configure tap detection: [tap_max_s, move_thresh_px, double_s, single_delay_s] */
  export function setTapParams(params: Float32Array | number[]): void;
}
