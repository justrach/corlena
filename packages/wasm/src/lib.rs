use wasm_bindgen::prelude::*;
use js_sys::{Float32Array, Int32Array, Object, Reflect, Uint8Array};
use std::cell::RefCell;
use std::collections::HashMap;

// Typed-array layout (MVP):
// nodes: [id, x, y, w, h, vx, vy, flags] * N
// pointers: [id, x, y, pressure, buttons] * P  (pressure optional; if omitted, stride=4)
// constraints: [left, top, right, bottom, gridX, gridY, inertia, damping]
// transforms out: [id, x, y, angle, scaleX, scaleY, reserved] * N
// events out (ring): [type, a, b, data] * E
//   type codes:
//     1 = drag_start (a=nodeId)
//     2 = drag_end   (a=nodeId)
//    10 = tap        (a=nodeId, b=1)
//    11 = double_tap (a=nodeId, b=2)

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
    // Tap detection state
    down_time: f32,
    down_x: f32,
    down_y: f32,
    max_move: f32,
    last_tap_time: f32,
    single_pending: bool,
    single_emit_time: f32,
}

#[derive(Clone, Debug)]
struct Image {
    w: u32,
    h: u32,
    data: Vec<u8>, // RGBA
}

#[derive(Clone, Debug)]
struct Particle {
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    r: f32,
    life: f32,
}

#[derive(Clone, Debug)]
struct DrawPath {
    id: i32,
    points: Vec<f32>, // [x, y, pressure, timestamp] * N
    color: u32,       // RGBA packed
    width: f32,
    closed: bool,
}

#[derive(Default)]
struct Engine {
    nodes: Vec<Node>,
    index: HashMap<i32, usize>,
    scale: f32,
    pan_x: f32,
    pan_y: f32,
    pixel_ratio: f32,
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
    // particles
    particles: Vec<Particle>,
    g_x: f32,
    g_y: f32,
    p_damping: f32,
    restitution: f32,
    // drawing paths
    draw_paths: HashMap<i32, DrawPath>,
    // events ring buffer (drain each frame)
    events: Vec<i32>,
    // time accumulator (seconds)
    time: f32,
    // tap config (seconds, pixels)
    tap_max_s: f32,
    move_thresh_px: f32,
    double_s: f32,
    single_delay_s: f32,
}

impl Engine {
    fn new(capacity: usize) -> Self {
        let mut e = Engine::default();
        e.nodes.reserve(capacity);
        e.scale = 1.0;
        e.pan_x = 0.0;
        e.pan_y = 0.0;
        e.pixel_ratio = 1.0;
        e.left = 0.0;
        e.top = 0.0;
        e.right = f32::INFINITY;
        e.bottom = f32::INFINITY;
        e.grid_x = 1.0;
        e.grid_y = 1.0;
        e.inertia = 0.0;
        e.damping = 1.0;
        e.images = HashMap::new();
        e.particles = Vec::new();
        e.draw_paths = HashMap::new();
        e.g_x = 0.0; // gravity x
        e.g_y = 600.0; // gravity y (px/s^2)
        e.p_damping = 0.999; // per frame exp factor (applied with powf(dt))
        e.restitution = 0.6; // bounce factor
        e.events = Vec::new();
        // time + tap defaults
        e.time = 0.0;
        e.tap_max_s = 0.28;       // max press duration for single tap
        e.move_thresh_px = 6.0;   // max movement (in world px)
        e.double_s = 0.28;        // max gap between taps for double
        e.single_delay_s = 0.25;  // delay before emitting single, to allow double
        e
    }

    fn reset(&mut self) {
        self.nodes.clear();
        self.index.clear();
        self.scale = 1.0;
        self.pan_x = 0.0; self.pan_y = 0.0; self.pixel_ratio = 1.0;
        self.left = 0.0; self.top = 0.0;
        self.right = f32::INFINITY; self.bottom = f32::INFINITY;
        self.grid_x = 1.0; self.grid_y = 1.0;
        self.inertia = 0.0; self.damping = 1.0;
        self.images.clear();
        self.particles.clear();
        self.draw_paths.clear();
        self.events.clear();
        self.time = 0.0;
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
                down_time: 0.0,
                down_x: 0.0,
                down_y: 0.0,
                max_move: 0.0,
                last_tap_time: -1000.0,
                single_pending: false,
                single_emit_time: 0.0,
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
        // Support stride 5 (with pressure) or 4 (without): [id, x, y, pressure?, buttons]
        let stride = if data.len() % 5 == 0 { 5 } else { 4 };
        if data.len() % stride != 0 { return; }
        for chunk in data.chunks(stride) {
            let id = chunk[0] as i32;
            // Convert incoming pointer coords from screen to world using current view params
            let s = if self.scale > 0.0 { self.scale } else { 1.0 };
            let pr = if self.pixel_ratio > 0.0 { self.pixel_ratio } else { 1.0 };
            let sx = chunk[1];
            let sy = chunk[2];
            let x = (sx / pr - self.pan_x) / s;
            let y = (sy / pr - self.pan_y) / s;
            let buttons = if stride == 5 { chunk[4] } else { chunk[3] };
            if let Some(&idx) = self.index.get(&id) {
                let n = &mut self.nodes[idx];
                if buttons > 0.0 {
                    // On press-start capture the offset between pointer and node top-left
                    if !n.grabbing {
                        n.grabbing = true;
                        n.grab_dx = n.x - x;
                        n.grab_dy = n.y - y;
                        // Tap start
                        n.down_time = self.time;
                        n.down_x = x;
                        n.down_y = y;
                        n.max_move = 0.0;
                        // Event: drag_start(nodeId)
                        self.events.extend_from_slice(&[1, id as i32, 0, 0]);
                    }
                    // track movement since press
                    let dx = x - n.down_x;
                    let dy = y - n.down_y;
                    let d = (dx*dx + dy*dy).sqrt();
                    if d > n.max_move { n.max_move = d; }
                    n.x = x + n.grab_dx;
                    n.y = y + n.grab_dy;
                    n.vx = 0.0; n.vy = 0.0;
                } else if n.grabbing {
                    // Release
                    n.grabbing = false;
                    // Event: drag_end(nodeId)
                    self.events.extend_from_slice(&[2, id as i32, 0, 0]);
                    // Determine tap vs drag based on duration and move threshold
                    let press_dur = (self.time - n.down_time).max(0.0);
                    let is_tap = press_dur <= self.tap_max_s && n.max_move <= self.move_thresh_px;
                    if is_tap {
                        let since_last = self.time - n.last_tap_time;
                        if since_last >= 0.0 && since_last <= self.double_s {
                            // Double tap: cancel pending single if any
                            if n.single_pending { n.single_pending = false; }
                            self.events.extend_from_slice(&[11, id as i32, 2, 0]);
                            n.last_tap_time = -1000.0;
                        } else {
                            // Schedule single tap after delay
                            n.single_pending = true;
                            n.single_emit_time = self.time + self.single_delay_s;
                            n.last_tap_time = self.time;
                        }
                    }
                }
            }
        }
    }

    fn step(&mut self, dt: f32) {
        // advance time
        self.time += dt.max(0.0);
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

        // Emit any scheduled single taps now that enough time has elapsed
        for n in &mut self.nodes {
            if n.single_pending && self.time >= n.single_emit_time {
                self.events.extend_from_slice(&[10, n.id as i32, 1, 0]);
                n.single_pending = false;
            }
        }

        // Particles integration
        if !self.particles.is_empty() {
            let g_x = self.g_x;
            let g_y = self.g_y;
            let p_damp = if self.p_damping < 1.0 { self.p_damping.powf(dt.max(0.0)) } else { 1.0 };
            let left = self.left; let top = self.top; let right = self.right; let bottom = self.bottom;
            let has_bounds = right.is_finite() && bottom.is_finite();
            for p in &mut self.particles {
                // integrate
                p.vx += g_x * dt;
                p.vy += g_y * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                if self.p_damping < 1.0 { p.vx *= p_damp; p.vy *= p_damp; }
                // bounds collision (simple circle vs rect)
                if has_bounds {
                    if p.x - p.r < left { p.x = left + p.r; p.vx = -p.vx * self.restitution; }
                    if p.x + p.r > right { p.x = right - p.r; p.vx = -p.vx * self.restitution; }
                    if p.y - p.r < top { p.y = top + p.r; p.vy = -p.vy * self.restitution; }
                    if p.y + p.r > bottom { p.y = bottom - p.r; p.vy = -p.vy * self.restitution; }
                }
                // lifetime decay
                p.life -= dt;
            }
            // remove dead
            self.particles.retain(|p| p.life > 0.0);
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

    fn write_particles(&self) -> Float32Array {
        // [x, y, vx, vy, r, life] * N
        let stride = 6usize;
        let mut out: Vec<f32> = Vec::with_capacity(self.particles.len() * stride);
        for p in &self.particles {
            out.push(p.x);
            out.push(p.y);
            out.push(p.vx);
            out.push(p.vy);
            out.push(p.r);
            out.push(p.life);
        }
        let arr = Float32Array::new_with_length(out.len() as u32);
        arr.copy_from(&out[..]);
        arr
    }

    fn write_draw_paths(&self) -> Float32Array {
        // Format: [path_id, color, width, closed, point_count, x1, y1, pressure1, timestamp1, x2, y2, ...] per path
        let mut out: Vec<f32> = Vec::new();
        for path in self.draw_paths.values() {
            out.push(path.id as f32);
            out.push(path.color as f32);
            out.push(path.width);
            out.push(if path.closed { 1.0 } else { 0.0 });
            out.push((path.points.len() / 4) as f32); // point count
            out.extend_from_slice(&path.points);
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
pub fn set_view_params(scale: f32, pan_x: f32, pan_y: f32, pixel_ratio: f32) {
    ENGINE.with(|e| {
        if let Some(ref mut eng) = *e.borrow_mut() {
            eng.scale = if scale > 0.0 { scale } else { 1.0 };
            eng.pan_x = pan_x;
            eng.pan_y = pan_y;
            eng.pixel_ratio = if pixel_ratio > 0.0 { pixel_ratio } else { 1.0 };
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
pub fn set_tap_params(params: Float32Array) {
    // [tap_max_s, move_thresh_px, double_s, single_delay_s]
    ENGINE.with(|e| {
        if let Some(ref mut eng) = *e.borrow_mut() {
            let mut buf = [0f32; 4];
            let len = params.length() as usize;
            let copy_len = len.min(4);
            for i in 0..copy_len { buf[i] = params.get_index(i as u32); }
            if copy_len >= 1 { eng.tap_max_s = buf[0].max(0.0); }
            if copy_len >= 2 { eng.move_thresh_px = buf[1].max(0.0); }
            if copy_len >= 3 { eng.double_s = buf[2].max(0.0); }
            if copy_len >= 4 { eng.single_delay_s = buf[3].max(0.0); }
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
    let (transforms, particles, draw_paths, events) = ENGINE.with(|e| {
        let mut transforms = Float32Array::new_with_length(0);
        let mut particles = Float32Array::new_with_length(0);
        let mut draw_paths = Float32Array::new_with_length(0);
        let mut events = Int32Array::new_with_length(0);
        if let Some(ref mut eng) = *e.borrow_mut() {
            eng.step(dt);
            transforms = eng.write_transforms();
            particles = eng.write_particles();
            draw_paths = eng.write_draw_paths();
            // Drain events ring buffer
            if !eng.events.is_empty() {
                let len = eng.events.len() as u32;
                let arr = Int32Array::new_with_length(len);
                // Copy from Vec<i32> to Int32Array
                for (i, v) in eng.events.iter().enumerate() { arr.set_index(i as u32, *v); }
                events = arr;
                eng.events.clear();
            }
        }
        (transforms, particles, draw_paths, events)
    });

    let obj = Object::new();
    Reflect::set(&obj, &JsValue::from_str("transforms"), &transforms).ok();
    Reflect::set(&obj, &JsValue::from_str("particles"), &particles).ok();
    Reflect::set(&obj, &JsValue::from_str("drawPaths"), &draw_paths).ok();
    Reflect::set(&obj, &JsValue::from_str("events"), &events).ok();
    JsValue::from(obj)
}

#[wasm_bindgen]
pub fn spawn_particles(data: Float32Array) -> u32 {
    // data stride 6: [x, y, vx, vy, r, life]
    let mut count = 0u32;
    ENGINE.with(|e| {
        if let Some(ref mut eng) = *e.borrow_mut() {
            let len = data.length() as usize;
            if len == 0 { return; }
            let mut buf = vec![0f32; len];
            data.copy_to(&mut buf);
            let stride = 6usize;
            for chunk in buf.chunks(stride) {
                if chunk.len() < stride { break; }
                let p = Particle { x: chunk[0], y: chunk[1], vx: chunk[2], vy: chunk[3], r: chunk[4].max(0.1), life: chunk[5].max(0.0) };
                if p.life > 0.0 { eng.particles.push(p); count += 1; }
            }
        }
    });
    count
}

#[wasm_bindgen]
pub fn clear_particles() {
    ENGINE.with(|e| {
        if let Some(ref mut eng) = *e.borrow_mut() { eng.particles.clear(); }
    });
}

#[wasm_bindgen]
pub fn seed_particles_for_bench(n: u32) {
    ENGINE.with(|e| {
        if let Some(ref mut eng) = *e.borrow_mut() {
            eng.particles.clear();
            let n = n as usize;
            for i in 0..n {
                let x = (i % 800) as f32;
                let y = (i / 800) as f32;
                eng.particles.push(Particle { x, y, vx: 10.0, vy: -5.0, r: 1.0, life: 10.0 });
            }
        }
    });
}

#[wasm_bindgen]
pub fn set_particle_params(params: Float32Array) {
    // [g_x, g_y, damping(0..1), restitution(0..1)]
    ENGINE.with(|e| {
        if let Some(ref mut eng) = *e.borrow_mut() {
            let mut buf = [0f32; 4];
            let len = params.length() as usize;
            let copy_len = len.min(4);
            for i in 0..copy_len { buf[i] = params.get_index(i as u32); }
            if copy_len >= 2 { eng.g_x = buf[0]; eng.g_y = buf[1]; }
            if copy_len >= 3 { eng.p_damping = buf[2].clamp(0.0, 1.0); }
            if copy_len >= 4 { eng.restitution = buf[3].clamp(0.0, 1.0); }
        }
    });
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
pub fn start_draw_path(id: i32, x: f32, y: f32, pressure: f32, color: u32, width: f32) -> bool {
    ENGINE.with(|e| {
        if let Some(ref mut eng) = *e.borrow_mut() {
            let path = DrawPath {
                id,
                points: vec![x, y, pressure, eng.time],
                color,
                width,
                closed: false,
            };
            eng.draw_paths.insert(id, path);
            true
        } else { false }
    })
}

#[wasm_bindgen]
pub fn add_draw_point(id: i32, x: f32, y: f32, pressure: f32) -> bool {
    ENGINE.with(|e| {
        if let Some(ref mut eng) = *e.borrow_mut() {
            if let Some(path) = eng.draw_paths.get_mut(&id) {
                path.points.extend_from_slice(&[x, y, pressure, eng.time]);
                true
            } else { false }
        } else { false }
    })
}

#[wasm_bindgen]
pub fn finish_draw_path(id: i32, closed: bool) -> bool {
    ENGINE.with(|e| {
        if let Some(ref mut eng) = *e.borrow_mut() {
            if let Some(path) = eng.draw_paths.get_mut(&id) {
                path.closed = closed;
                true
            } else { false }
        } else { false }
    })
}

#[wasm_bindgen]
pub fn remove_draw_path(id: i32) -> bool {
    ENGINE.with(|e| {
        if let Some(ref mut eng) = *e.borrow_mut() {
            eng.draw_paths.remove(&id).is_some()
        } else { false }
    })
}

#[wasm_bindgen]
pub fn clear_draw_paths() {
    ENGINE.with(|e| {
        if let Some(ref mut eng) = *e.borrow_mut() {
            eng.draw_paths.clear();
        }
    });
}

#[wasm_bindgen]
pub fn get_draw_paths_count() -> u32 {
    ENGINE.with(|e| {
        if let Some(ref eng) = *e.borrow() {
            eng.draw_paths.len() as u32
        } else { 0 }
    })
}

// Pure helpers for testing image resizing logic without wasm-bindgen types.
fn resize_nearest_rgba(src: &[u8], sw: u32, sh: u32, ow: u32, oh: u32) -> Vec<u8> {
    let sw = sw.max(1);
    let sh = sh.max(1);
    let ow = ow.max(1);
    let oh = oh.max(1);
    let mut dst = vec![0u8; (ow as usize) * (oh as usize) * 4];
    for y in 0..oh {
        let sy = (y as u64 * sh as u64) / oh as u64;
        for x in 0..ow {
            let sx = (x as u64 * sw as u64) / ow as u64;
            let si = ((sy as usize) * (sw as usize) + (sx as usize)) * 4;
            let di = ((y as usize) * (ow as usize) + (x as usize)) * 4;
            dst[di..di + 4].copy_from_slice(&src[si..si + 4]);
        }
    }
    dst
}

fn resize_bilinear_rgba(src: &[u8], sw: u32, sh: u32, ow: u32, oh: u32) -> Vec<u8> {
    let sw = sw.max(1);
    let sh = sh.max(1);
    let ow = ow.max(1);
    let oh = oh.max(1);
    let mut dst = vec![0u8; (ow as usize) * (oh as usize) * 4];
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
                let c00 = src[i00 + ch] as f32;
                let c10 = src[i10 + ch] as f32;
                let c01 = src[i01 + ch] as f32;
                let c11 = src[i11 + ch] as f32;
                let c0 = c00 + (c10 - c00) * wx;
                let c1 = c01 + (c11 - c01) * wx;
                let mut v = (c0 + (c1 - c0) * wy).round();
                if v < 0.0 { v = 0.0; }
                if v > 255.0 { v = 255.0; }
                dst[di + ch] = v as u8;
            }
        }
    }
    dst
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_engine_with_bounds(left: f32, top: f32, right: f32, bottom: f32) -> Engine {
        let mut e = Engine::new(0);
        e.left = left;
        e.top = top;
        e.right = right;
        e.bottom = bottom;
        e
    }

    #[test]
    fn particles_gravity_integration() {
        let mut e = make_engine_with_bounds(0.0, 0.0, 100.0, 100.0);
        e.g_x = 0.0;
        e.g_y = 1000.0;
        e.p_damping = 1.0; // no damping effect
        e.restitution = 0.0;
        e.particles.push(Particle { x: 50.0, y: 10.0, vx: 0.0, vy: 0.0, r: 2.0, life: 1.0 });
        e.step(0.016);
        assert!(e.particles[0].vy > 0.0, "gravity should increase vy");
        assert!(e.particles[0].y > 10.0, "y should increase under gravity");
    }

    #[test]
    fn particles_bounce_bottom() {
        let mut e = make_engine_with_bounds(0.0, 0.0, 100.0, 100.0);
        e.g_y = 0.0; // isolate bounce
        e.restitution = 0.5;
        e.particles.push(Particle { x: 50.0, y: 99.0, vx: 0.0, vy: 100.0, r: 2.0, life: 1.0 });
        e.step(0.05);
        let p = &e.particles[0];
        assert!(p.y <= 100.0 - p.r + 1e-3, "should clamp to bottom");
        assert!(p.vy <= 0.0, "should invert vy on bounce");
    }

    #[test]
    fn particles_damping_applied() {
        let mut e = make_engine_with_bounds(0.0, 0.0, f32::INFINITY, f32::INFINITY);
        e.g_x = 0.0;
        e.g_y = 0.0;
        e.p_damping = 0.5; // strong damping
        e.particles.push(Particle { x: 0.0, y: 0.0, vx: 10.0, vy: 0.0, r: 1.0, life: 10.0 });
        e.step(1.0);
        let v = e.particles[0].vx;
        assert!(v.abs() < 10.0, "velocity should reduce with damping");
    }

    #[test]
    fn particles_lifetime_removal() {
        let mut e = make_engine_with_bounds(0.0, 0.0, 10.0, 10.0);
        e.particles.push(Particle { x: 0.0, y: 0.0, vx: 0.0, vy: 0.0, r: 1.0, life: 0.01 });
        e.step(0.02);
        assert!(e.particles.is_empty(), "expired particles should be removed");
    }

    #[test]
    #[ignore]
    fn perf_smoke_fps_estimate() {
        use std::time::Instant;
        fn run_case(n: usize, steps: usize) -> f64 {
            let mut e = make_engine_with_bounds(0.0, 0.0, 1920.0, 1080.0);
            e.g_x = 0.0;
            e.g_y = 500.0;
            e.p_damping = 0.02;
            e.restitution = 0.2;
            for i in 0..n {
                let x = (i % 800) as f32 as f32;
                let y = (i / 800) as f32 as f32;
                e.particles.push(Particle { x, y, vx: 10.0, vy: -5.0, r: 1.0, life: 10.0 });
            }
            let dt = 1.0 / 60.0;
            let start = Instant::now();
            for _ in 0..steps { e.step(dt); }
            let dur = start.elapsed();
            let avg_ms = (dur.as_secs_f64() * 1000.0) / steps as f64;
            let fps = 1000.0 / avg_ms;
            eprintln!("particles={}, avg_step_ms={:.3}, est_fps={:.1}", n, avg_ms, fps);
            fps
        }
        // Keep quick to run even if someone un-ignores accidentally
        let _ = run_case(100, 240);
        let _ = run_case(1_000, 240);
        let _ = run_case(5_000, 120);
    }
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
