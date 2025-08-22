use wasm_bindgen::prelude::*;
use js_sys::{Float32Array, Int32Array, Object, Reflect, Uint8Array};
use std::cell::RefCell;
use std::collections::HashMap;

// Typed-array layout (MVP):
// nodes: [id, x, y, w, h, vx, vy, flags] * N
// pointers: [id, x, y, buttons] * P
// constraints: [left, top, right, bottom, gridX, gridY, inertia, damping]
// transforms out: [id, x, y, angle, scaleX, scaleY, reserved] * N

#[derive(Clone, Debug)]
struct Node {
    id: i32,
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    vx: f32,
    vy: f32,
    flags: u32,
    // Drag state
    grabbing: bool,
    grab_dx: f32,
    grab_dy: f32,
}

#[derive(Clone, Debug)]
struct Image {
    w: u32,
    h: u32,
    data: Vec<u8>, // RGBA
}

#[derive(Default)]
struct Engine {
    nodes: Vec<Node>,
    index: HashMap<i32, usize>,
    scale: f32,
    // constraints/state
    left: f32,
    top: f32,
    right: f32,
    bottom: f32,
    grid_x: f32,
    grid_y: f32,
    inertia: f32,
    damping: f32,
    // image store (RGBA)
    images: HashMap<i32, Image>,
}

impl Engine {
    fn new(capacity: usize) -> Self {
        let mut e = Engine::default();
        e.nodes.reserve(capacity);
        e.scale = 1.0;
        e.left = 0.0;
        e.top = 0.0;
        e.right = f32::INFINITY;
        e.bottom = f32::INFINITY;
        e.grid_x = 1.0;
        e.grid_y = 1.0;
        e.inertia = 0.0;
        e.damping = 1.0;
        e.images = HashMap::new();
        e
    }

    fn reset(&mut self) {
        self.nodes.clear();
        self.index.clear();
        self.scale = 1.0;
        self.left = 0.0; self.top = 0.0;
        self.right = f32::INFINITY; self.bottom = f32::INFINITY;
        self.grid_x = 1.0; self.grid_y = 1.0;
        self.inertia = 0.0; self.damping = 1.0;
        self.images.clear();
    }

    fn upsert_nodes(&mut self, data: &[f32]) {
        // chunk size = 8 f32s per node (id is f32 in the buffer; cast to i32)
        let stride = 8;
        if data.len() % stride != 0 { return; }
        for chunk in data.chunks(stride) {
            let id = chunk[0] as i32;
            let n = Node {
                id,
                x: chunk[1], y: chunk[2],
                w: chunk[3], h: chunk[4],
                vx: chunk[5], vy: chunk[6],
                flags: chunk[7] as u32,
                grabbing: false,
                grab_dx: 0.0,
                grab_dy: 0.0,
            };
            if let Some(&idx) = self.index.get(&id) {
                self.nodes[idx] = n;
            } else {
                let idx = self.nodes.len();
                self.nodes.push(n);
                self.index.insert(id, idx);
            }
        }
    }

    fn apply_pointers(&mut self, data: &[f32]) {
        // stride 4: [id, x, y, buttons]
        let stride = 4;
        if data.len() % stride != 0 { return; }
        for chunk in data.chunks(stride) {
            let id = chunk[0] as i32;
            // Convert incoming pointer coords from screen to world using current view scale
            let s = if self.scale > 0.0 { self.scale } else { 1.0 };
            let x = chunk[1] / s;
            let y = chunk[2] / s;
            let buttons = chunk[3];
            if let Some(&idx) = self.index.get(&id) {
                let n = &mut self.nodes[idx];
                if buttons > 0.0 {
                    // On press-start capture the offset between pointer and node top-left
                    if !n.grabbing {
                        n.grabbing = true;
                        n.grab_dx = n.x - x;
                        n.grab_dy = n.y - y;
                    }
                    n.x = x + n.grab_dx;
                    n.y = y + n.grab_dy;
                    n.vx = 0.0; n.vy = 0.0;
                } else if n.grabbing {
                    // Release
                    n.grabbing = false;
                }
            }
        }
    }

    fn step(&mut self, dt: f32) {
        // Integrate velocities with optional inertia + damping
        let use_inertia = self.inertia > 0.0;
        let damp = if self.damping < 1.0 { self.damping.powf(dt.max(0.0)) } else { 1.0 };
        for n in &mut self.nodes {
            if use_inertia {
                n.x += n.vx * dt;
                n.y += n.vy * dt;
                if self.damping < 1.0 {
                    n.vx *= damp; n.vy *= damp;
                    if n.vx.abs() < 1e-3 { n.vx = 0.0; }
                    if n.vy.abs() < 1e-3 { n.vy = 0.0; }
                }
            }
            // Grid snapping (steps <= 1 mean no-op), but skip while actively grabbing to prevent jump
            if !n.grabbing {
                if self.grid_x > 1.0 { n.x = (n.x / self.grid_x).round() * self.grid_x; }
                if self.grid_y > 1.0 { n.y = (n.y / self.grid_y).round() * self.grid_y; }
            }
            // Clamp to bounds
            let max_x = if self.right.is_finite() { (self.right - self.left - n.w).max(0.0) } else { f32::INFINITY };
            let max_y = if self.bottom.is_finite() { (self.bottom - self.top - n.h).max(0.0) } else { f32::INFINITY };
            n.x = n.x.max(self.left).min(self.left + max_x);
            n.y = n.y.max(self.top).min(self.top + max_y);
        }
    }

    fn write_transforms(&self) -> Float32Array {
        // [id, x, y, angle, scaleX, scaleY, reserved]
        let stride = 7usize;
        let mut out: Vec<f32> = Vec::with_capacity(self.nodes.len() * stride);
        for n in &self.nodes {
            out.push(n.id as f32);
            out.push(n.x);
            out.push(n.y);
            out.push(0.0); // angle
            out.push(self.scale.max(0.0001)); // scaleX
            out.push(self.scale.max(0.0001)); // scaleY
            out.push(0.0); // reserved
        }
        let arr = Float32Array::new_with_length(out.len() as u32);
        arr.copy_from(&out[..]);
        arr
    }
}

thread_local! {
    static ENGINE: RefCell<Option<Engine>> = RefCell::new(None);
}

#[wasm_bindgen]
pub fn init(capacity: u32) {
    ENGINE.with(|e| {
        *e.borrow_mut() = Some(Engine::new(capacity as usize));
    });
}

#[wasm_bindgen]
pub fn reset() {
    ENGINE.with(|e| {
        if let Some(ref mut eng) = *e.borrow_mut() {
            eng.reset();
        }
    });
}

#[wasm_bindgen]
pub fn set_view(scale: f32) {
    ENGINE.with(|e| {
        if let Some(ref mut eng) = *e.borrow_mut() {
            eng.scale = if scale > 0.0 { scale } else { 1.0 };
        }
    });
}

#[wasm_bindgen]
pub fn set_constraints(params: Float32Array) {
    ENGINE.with(|e| {
        if let Some(ref mut eng) = *e.borrow_mut() {
            let mut buf = [0f32; 8];
            let len = params.length() as usize;
            let copy_len = len.min(8);
            for i in 0..copy_len { buf[i] = params.get_index(i as u32); }
            if copy_len >= 4 {
                eng.left = buf[0]; eng.top = buf[1]; eng.right = buf[2]; eng.bottom = buf[3];
            }
            if copy_len >= 6 { eng.grid_x = buf[4].max(0.0); eng.grid_y = buf[5].max(0.0); }
            if copy_len >= 8 { eng.inertia = buf[6].max(0.0); eng.damping = buf[7].clamp(0.0, 1.0); }
        }
    });
}

#[wasm_bindgen]
pub fn upsert_nodes(nodes: Float32Array) {
    ENGINE.with(|e| {
        if let Some(ref mut eng) = *e.borrow_mut() {
            let mut buf = vec![0f32; nodes.length() as usize];
            nodes.copy_to(&mut buf);
            eng.upsert_nodes(&buf);
        }
    });
}

#[wasm_bindgen]
pub fn apply_pointers(pointers: Float32Array) {
    ENGINE.with(|e| {
        if let Some(ref mut eng) = *e.borrow_mut() {
            let mut buf = vec![0f32; pointers.length() as usize];
            pointers.copy_to(&mut buf);
            eng.apply_pointers(&buf);
        }
    });
}

#[wasm_bindgen]
pub fn process_frame(dt: f32) -> JsValue {
    let (transforms, events) = ENGINE.with(|e| {
        let mut transforms = Float32Array::new_with_length(0);
        if let Some(ref mut eng) = *e.borrow_mut() {
            eng.step(dt);
            transforms = eng.write_transforms();
        }
        let events = Int32Array::new_with_length(0); // event ring buffer stub
        (transforms, events)
    });

    let obj = Object::new();
    Reflect::set(&obj, &JsValue::from_str("transforms"), &transforms).ok();
    Reflect::set(&obj, &JsValue::from_str("events"), &events).ok();
    JsValue::from(obj)
}

#[wasm_bindgen]
pub fn store_image(id: i32, rgba: Uint8Array, w: u32, h: u32) -> bool {
    if w == 0 || h == 0 { return false; }
    ENGINE.with(|e| {
        if let Some(ref mut eng) = *e.borrow_mut() {
            let expected = (w as usize).saturating_mul(h as usize).saturating_mul(4);
            if (rgba.length() as usize)  < expected { return false; }
            let mut buf = vec![0u8; expected];
            rgba.copy_to(&mut buf[..]);
            eng.images.insert(id, Image { w, h, data: buf });
            true
        } else { false }
    })
}

#[wasm_bindgen]
pub fn resize_image(id: i32, out_w: u32, out_h: u32) -> Uint8Array {
    let mut out = Uint8Array::new_with_length(0);
    ENGINE.with(|e| {
        if let Some(ref eng) = *e.borrow() {
            if let Some(img) = eng.images.get(&id) {
                let sw = img.w.max(1); let sh = img.h.max(1);
                let ow = out_w.max(1); let oh = out_h.max(1);
                let mut dst = vec![0u8; (ow as usize) * (oh as usize) * 4];
                for y in 0..oh {
                    let sy = (y as u64 * sh as u64) / oh as u64;
                    for x in 0..ow {
                        let sx = (x as u64 * sw as u64) / ow as u64;
                        let si = ((sy as usize) * (sw as usize) + (sx as usize)) * 4;
                        let di = ((y as usize) * (ow as usize) + (x as usize)) * 4;
                        dst[di..di+4].copy_from_slice(&img.data[si..si+4]);
                    }
                }
                let arr = Uint8Array::new_with_length(dst.len() as u32);
                arr.copy_from(&dst[..]);
                out = arr;
            }
        }
    });
    out
}

#[wasm_bindgen]
pub fn resize_image_mode(id: i32, out_w: u32, out_h: u32, mode: u32) -> Uint8Array {
    let mut out = Uint8Array::new_with_length(0);
    ENGINE.with(|e| {
        if let Some(ref eng) = *e.borrow() {
            if let Some(img) = eng.images.get(&id) {
                let sw = img.w.max(1);
                let sh = img.h.max(1);
                let ow = out_w.max(1);
                let oh = out_h.max(1);
                let mut dst = vec![0u8; (ow as usize) * (oh as usize) * 4];

                if mode == 1 {
                    // Bilinear sampling
                    let sw_f = sw as f32;
                    let sh_f = sh as f32;
                    let ow_f = ow as f32;
                    let oh_f = oh as f32;
                    for y in 0..oh {
                        let gy = (y as f32) * sh_f / oh_f;
                        let y0 = gy.floor() as i32;
                        let y1 = (y0 + 1).min(sh as i32 - 1).max(0);
                        let wy = gy - (y0 as f32);
                        let y0u = y0.max(0) as usize;
                        let y1u = y1 as usize;
                        for x in 0..ow {
                            let gx = (x as f32) * sw_f / ow_f;
                            let x0 = gx.floor() as i32;
                            let x1 = (x0 + 1).min(sw as i32 - 1).max(0);
                            let wx = gx - (x0 as f32);

                            let x0u = x0.max(0) as usize;
                            let x1u = x1 as usize;
                            let i00 = ((y0u * sw as usize) + x0u) * 4;
                            let i10 = ((y0u * sw as usize) + x1u) * 4;
                            let i01 = ((y1u * sw as usize) + x0u) * 4;
                            let i11 = ((y1u * sw as usize) + x1u) * 4;
                            let di = ((y as usize) * (ow as usize) + (x as usize)) * 4;

                            for ch in 0..4 {
                                let c00 = img.data[i00 + ch] as f32;
                                let c10 = img.data[i10 + ch] as f32;
                                let c01 = img.data[i01 + ch] as f32;
                                let c11 = img.data[i11 + ch] as f32;
                                let c0 = c00 + (c10 - c00) * wx;
                                let c1 = c01 + (c11 - c01) * wx;
                                let val = c0 + (c1 - c0) * wy;
                                let mut v = val.round();
                                if v < 0.0 { v = 0.0; }
                                if v > 255.0 { v = 255.0; }
                                dst[di + ch] = v as u8;
                            }
                        }
                    }
                } else {
                    // Nearest-neighbor (same as resize_image)
                    for y in 0..oh {
                        let sy = (y as u64 * sh as u64) / oh as u64;
                        for x in 0..ow {
                            let sx = (x as u64 * sw as u64) / ow as u64;
                            let si = ((sy as usize) * (sw as usize) + (sx as usize)) * 4;
                            let di = ((y as usize) * (ow as usize) + (x as usize)) * 4;
                            dst[di..di+4].copy_from_slice(&img.data[si..si+4]);
                        }
                    }
                }

                let arr = Uint8Array::new_with_length(dst.len() as u32);
                arr.copy_from(&dst[..]);
                out = arr;
            }
        }
    });
    out
}
