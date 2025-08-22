/* tslint:disable */
/* eslint-disable */
export function init(capacity: number): void;
export function reset(): void;
export function set_view(scale: number): void;
export function set_constraints(params: Float32Array): void;
export function upsert_nodes(nodes: Float32Array): void;
export function apply_pointers(pointers: Float32Array): void;
export function process_frame(dt: number): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly init: (a: number) => void;
  readonly set_constraints: (a: any) => void;
  readonly upsert_nodes: (a: any) => void;
  readonly apply_pointers: (a: any) => void;
  readonly process_frame: (a: number) => any;
  readonly reset: () => void;
  readonly set_view: (a: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
