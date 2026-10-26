// World layout and static geometry for the teaching processor (Fig. 5).
// Built with the Anatomy kit. World units are about 1 px, x and y on the
// board, z up. Everything is rebuilt when the camera azimuth changes.

import {
  boxCorners,
  corners,
  cylinder,
  depthOf,
  dotGrid,
  extrude,
  fitProjection,
  haloOf,
  insetPlan,
  iso,
  knurl,
  lineOnTop,
  onTop,
  pathOf,
  planOutline,
  pointsAt,
  radialTicks,
  ring,
  sideArc,
  sideSeam,
  slabOf,
  topMatrix,
  topTicks,
  type Flat,
  type Plan,
  type Plane,
  type Point3,
  type Projection,
  type SolidPaths,
} from "../kit/iso-kit";
import type { Bus, Part } from "../sim/machine";

export const WIDTH = 760;
export const HEIGHT = 410;

export const BOARD: Plan = { x: -210, y: -120, w: 410, d: 238, r: 10 };
const BOARD_Z = -8;
const BOARD_H = 8;

export const PLANS = {
  icache: { x: -192, y: -82, w: 57, d: 46, r: 3 } as Plan,
  fetch: { x: -192, y: 20, w: 62, d: 56, r: 4 } as Plan,
  decoder: { x: -115, y: 20, w: 90, d: 60, r: 3 } as Plan,
  control: { x: -112, y: -60, w: 72, d: 50, r: 3 } as Plan,
  regfile: { x: -10, y: 20, w: 84, d: 50, r: 3 } as Plan,
  dcache: { x: 100, y: -82, w: 60, d: 46, r: 3 } as Plan,
  memif: { x: -15, y: -94, w: 90, d: 30, r: 3 } as Plan,
  socket: { x: -10, y: -114, w: 80, d: 10, r: 1.5 } as Plan,
  mux: { x: 124, y: -16, w: 14, d: 12, r: 2 } as Plan,
};

export const HEIGHTS = { icache: 36, dcache: 36, fetch: 12, decoder: 10, control: 12, regfile: 42, memif: 10, alu: 16, mux: 8 };

export const ALU_RING: Plane[] = [
  [90, 20], [150, 34], [150, 66], [90, 80], [90, 58], [98, 50], [90, 42],
];

/** Board traces: axis-aligned routes between real ports on module faces. */
export const ROUTES: Record<Bus, Plane[]> = {
  "mem-icache": [[-15, -70], [-135, -70]],
  "icache-fetch": [[-162, -36], [-162, 20]],
  "fetch-decoder": [[-130, 48], [-115, 48]],
  "decoder-control": [[-75, 20], [-75, -10]],
  "decoder-regfile": [[-25, 45], [-10, 45]],
  "regfile-alu": [[74, 30], [90, 30]],
  "imm-alu": [[-40, 80], [-40, 92], [82, 92], [82, 70], [90, 70]],
  "control-alu": [[-40, -30], [120, -30], [120, 27]],
  "alu-dcache": [[150, 50], [180, 50], [180, -58], [160, -58]],
  "regfile-dcache": [[40, 20], [40, -46], [100, -46]],
  "dcache-mem": [[100, -66], [75, -66]],
  "dcache-regfile": [[130, -36], [130, -16]],
  "alu-regfile": [[150, 44], [168, 44], [168, -10], [138, -10]],
};
/** The write-back run from the mux to the register file, shared by both write-back buses. */
export const WB_RUN: Plane[] = [[124, -10], [66, -10], [66, 20]];

export const PART_OF_PLAN: Record<string, Part> = { icache: "icache", fetch: "fetch", decoder: "decoder", control: "control", regfile: "regfile", dcache: "dcache", memif: "memif", alu: "alu" };

const TRACE_W = 3.2;
const TRACE_H = 0.7;

export interface Solidish {
  paths: SolidPaths;
  tone: "hi" | "mid" | "lo" | "faint";
  crease?: "hi" | "mid" | "lo" | "faint" | "none";
  flat?: boolean;
  inner?: string; // line path drawn under the outline
}

export interface ModuleArt {
  part: Part | "board";
  key: string;
  depth: number;
  lift: number; // explode lift, world units
  halo: string;
  solids: Solidish[];
  lines: { d: string; tone: "hi" | "mid" | "lo" | "faint" | "lit"; free?: boolean }[];
  dots: { points: Flat[]; size: number; tone: "hi" | "mid" | "lo" | "faint" }[];
}

const join = (list: string[]) => list.filter(Boolean).join("");

function crossingsOf(routes: Plane[][]) {
  // Every crossing between a later route's segment and an earlier one's.
  const cuts: { route: number; at: Plane; axis: "x" | "y" }[] = [];
  const segs = routes.map((r) => r.slice(1).map((b, i) => [r[i], b] as [Plane, Plane]));
  for (let a = 0; a < segs.length; a++) {
    for (let b = 0; b < a; b++) {
      for (const [p0, p1] of segs[a]) {
        for (const [q0, q1] of segs[b]) {
          const aVert = p0[0] === p1[0];
          const bVert = q0[0] === q1[0];
          if (aVert === bVert) continue;
          const [v0, v1, h0, h1] = aVert ? [p0, p1, q0, q1] : [q0, q1, p0, p1];
          const x = v0[0];
          const y = h0[1];
          const inV = y > Math.min(v0[1], v1[1]) + 0.5 && y < Math.max(v0[1], v1[1]) - 0.5;
          const inH = x > Math.min(h0[0], h1[0]) + 0.5 && x < Math.max(h0[0], h1[0]) - 0.5;
          if (inV && inH) cuts.push({ route: a, at: [x, y], axis: aVert ? "y" : "x" });
        }
      }
    }
  }
  return cuts;
}

const GAP = 5; // half-length of the run a crossing trace spends on the inner layer

/** Split a route into the runs drawn on the top layer, given via positions on it. */
function runsOf(route: Plane[], vias: Plane[]): Plane[][] {
  if (!vias.length) return [route];
  const runs: Plane[][] = [];
  let cur: Plane[] = [route[0]];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const dir: Plane = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
    const onSeg = vias
      .filter((v) => (dir[0] ? v[1] === a[1] && (v[0] - a[0]) * dir[0] > 0 && (b[0] - v[0]) * dir[0] > 0 : v[0] === a[0] && (v[1] - a[1]) * dir[1] > 0 && (b[1] - v[1]) * dir[1] > 0))
      .sort((p, q) => (dir[0] ? (p[0] - q[0]) * dir[0] : (p[1] - q[1]) * dir[1]));
    for (const v of onSeg) {
      cur.push([v[0] - dir[0] * GAP, v[1] - dir[1] * GAP]);
      runs.push(cur);
      cur = [[v[0] + dir[0] * GAP, v[1] + dir[1] * GAP]];
    }
    cur.push(b);
  }
  runs.push(cur);
  return runs;
}

function stripOf(a: Plane, b: Plane, P: Projection): SolidPaths {
  const x0 = Math.min(a[0], b[0]) - TRACE_W / 2;
  const y0 = Math.min(a[1], b[1]) - TRACE_W / 2;
  const plan = { x: x0, y: y0, w: Math.abs(b[0] - a[0]) + TRACE_W, d: Math.abs(b[1] - a[1]) + TRACE_W, r: 1.2 };
  return slabOf(plan, 0, TRACE_H, P, 3);
}

export interface TraceArt {
  bus: Bus | "wb";
  strips: SolidPaths[];
  center: string; // the line drawn lit when active
  ends: Flat[]; // terminal dots on the module faces
  vias: Flat[]; // via pads where it dives under a crossing trace
  depth: number;
}

export function buildFigure(azimuth: number) {
  const fitPoints: Point3[] = [
    ...boxCorners(BOARD, BOARD_Z - 8, 0),
    ...boxCorners(PLANS.regfile, 0, HEIGHTS.regfile),
    ...boxCorners(PLANS.socket, 0, 38),
  ];
  const P = fitProjection(fitPoints, WIDTH, HEIGHT, { pad: 30, azimuth });
  const at = (p: Point3) => iso(p, P);
  const depth = (x: number, y: number, z = 0) => depthOf([x, y, z], P);
  const mid = (plan: Plan): Plane => [plan.x + plan.w / 2, plan.y + plan.d / 2];

  // --- Board ---
  const feet = corners(BOARD, 24)
    .sort((a, b) => depth(a[0], a[1]) - depth(b[0], b[1]))
    .map(([x, y]) => [cylinder(x, y, 8, BOARD_Z - 8, 1.8, P, 32), cylinder(x, y, 6, BOARD_Z - 6.2, 6.2, P, 28)]);
  const boardSlab = slabOf(BOARD, BOARD_Z, BOARD_H, P, 10, 1.4);
  const groove = planOutline(insetPlan(BOARD, 6), 0, P, 10);
  const screwPts = corners(BOARD, 13);
  const screwRings = join(screwPts.map(([x, y]) => ring(x, y, 2.4, 0, P, 18)));
  const screws = pointsAt(screwPts.map(([x, y]) => [x, y, 0] as Point3), P);
  const strip: Plan = { x: -190, y: 104, w: 228, d: 7, r: 1 };
  const stripSlab = slabOf(strip, 0, 0.6, P, 3);
  const ticks = topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.8], P);
  const label: Plan = { x: 62, y: 99, w: 92, d: 15, r: 2 };
  const labelSlab = slabOf(label, 0, 0.8, P, 4);
  const labelLine = planOutline(insetPlan(label, 1.6), 0.8, P, 4);
  const labelText = topMatrix([label.x + 5, label.y + 7.6], 0.8, P);
  const labelRules = join([lineOnTop([label.x + 5, label.y + 10.6], [label.x + 58, label.y + 10.6], 0.8, P), lineOnTop([label.x + 5, label.y + 12.4], [label.x + 40, label.y + 12.4], 0.8, P)]);
  const labelScrews = pointsAt([[label.x + label.w - 4, label.y + 4, 0.8], [label.x + label.w - 4, label.y + label.d - 4, 0.8]], P);
  // Decoupling capacitors and a crystal, part of the board.
  const caps: Plane[] = [[-125, -20], [-125, 0], [86, -60], [86, -74], [-30, -40], [-180, 90], [-150, 92], [180, 80], [180, 94], [160, 90]];
  const crystal: Plan = { x: -60, y: -48, w: 14, d: 6, r: 2.8 };

  // --- Traces with vias ---
  const order = Object.keys(ROUTES) as Bus[];
  const routes = [...order.map((b) => ROUTES[b]), WB_RUN];
  const cuts = crossingsOf(routes);
  const traces: TraceArt[] = routes.map((route, index) => {
    const vias = cuts.filter((c) => c.route === index).map((c) => c.at);
    const runs = runsOf(route, vias);
    const strips: SolidPaths[] = [];
    for (const run of runs) for (let i = 1; i < run.length; i++) strips.push(stripOf(run[i - 1], run[i], P));
    const viaPts: Flat[] = [];
    for (const run of runs.slice(0, -1)) viaPts.push(at([...run[run.length - 1], TRACE_H] as Point3));
    for (const run of runs.slice(1)) viaPts.push(at([...run[0], TRACE_H] as Point3));
    return {
      bus: index < order.length ? order[index] : "wb",
      strips,
      center: join(runs.map((run) => onTop(run, TRACE_H, P))),
      ends: [route[0], route[route.length - 1]].map((p) => at([p[0], p[1], TRACE_H])),
      vias: viaPts,
      depth: Math.min(...route.map((p) => depth(p[0], p[1]))),
    };
  });
  const viaRings = join(cuts.flatMap((c) => {
    const d: Plane = c.axis === "x" ? [GAP, 0] : [0, GAP];
    return [ring(c.at[0] - d[0], c.at[1] - d[1], 2.2, TRACE_H, P, 14), ring(c.at[0] + d[0], c.at[1] + d[1], 2.2, TRACE_H, P, 14)];
  }));

  // --- Modules ---
  const modules: ModuleArt[] = [];
  const add = (m: Omit<ModuleArt, "depth" | "lift"> & { anchor: Plane }) => {
    const { anchor, ...rest } = m;
    modules.push({ ...rest, depth: depth(anchor[0], anchor[1]), lift: 0 });
  };

  // Cabinet (I-cache, D-cache): body, top details. Drawers are dynamic.
  const cabinet = (plan: Plan, h: number, part: Part, key: string) => {
    const body = slabOf(plan, 0, h, P, 6, 0.8);
    const seam = sideSeam(plan, h - 4, P, 6);
    const top = insetPlan(plan, 5);
    const vents = join(Array.from({ length: 5 }, (_, i) => planOutline({ x: top.x + 4, y: top.y + 6 + i * 5.5, w: top.w - 22, d: 2.2, r: 1.1 }, h, P, 3)));
    const scr = corners(plan, 4).map(([x, y]) => [x, y, h] as Point3);
    add({
      part,
      key,
      anchor: mid(plan),
      halo: haloOf(plan, 0, h, P),
      solids: [{ paths: body, tone: part === "dcache" || part === "icache" ? "hi" : "mid", inner: seam }],
      lines: [{ d: planOutline(top, h, P, 4), tone: "faint" }, { d: vents, tone: "lo" }],
      dots: [{ points: pointsAt(scr, P), size: 0.5, tone: "mid" }],
    });
  };
  cabinet(PLANS.icache, HEIGHTS.icache, "icache", "icache");
  cabinet(PLANS.dcache, HEIGHTS.dcache, "dcache", "dcache");

  // Fetch unit with its PC dial gauge (needle is dynamic).
  {
    const p = PLANS.fetch;
    const h = HEIGHTS.fetch;
    const dial = { x: -161, y: 46, r: 19 };
    const plate: Plan = { x: p.x + 4, y: p.y + 4, w: p.w - 8, d: p.d - 8, r: 2.5 };
    const knob = { x: -137, y: 69, r: 4.4 };
    const t = radialTicks(dial.x, dial.y, dial.r - 3.4, 64, 4, h + 6, [1.4, 3], P);
    add({
      part: "fetch",
      key: "fetch",
      anchor: mid(p),
      halo: haloOf(p, 0, h, P),
      solids: [
        { paths: slabOf(p, 0, h, P, 6, 0.8), tone: "mid", inner: sideSeam(p, 4, P, 6) },
        { paths: slabOf(plate, h, 0.6, P, 4), tone: "lo", crease: "none" },
        { paths: cylinder(dial.x, dial.y, dial.r + 1.6, h + 0.6, 2, P, 64), tone: "mid" },
        { paths: cylinder(dial.x, dial.y, dial.r, h + 2.6, 3.4, P, 64, 0.6), tone: "hi", inner: knurl(dial.x, dial.y, dial.r, h + 2.6, h + 6, 72, P, 0.3) },
        { paths: cylinder(knob.x, knob.y, knob.r + 1.2, h + 0.6, 1.4, P, 28), tone: "lo" },
        { paths: cylinder(knob.x, knob.y, knob.r, h + 2, 5, P, 32), tone: "mid", inner: knurl(knob.x, knob.y, knob.r, h + 2, h + 7, 26, P) },
      ],
      lines: [
        { d: ring(dial.x, dial.y, dial.r - 2.2, h + 6, P, 64), tone: "lo" },
        { d: t.minor, tone: "lo" },
        { d: t.major, tone: "mid" },
        { d: ring(dial.x, dial.y, 1.8, h + 6, P, 16), tone: "mid" },
        { d: lineOnTop([knob.x - 2.4, knob.y], [knob.x + 3.6, knob.y], h + 7, P), tone: "hi" },
      ],
      dots: [{ points: pointsAt(corners(plate, 3.5).map(([x, y]) => [x, y, h + 0.6] as Point3), P), size: 0.45, tone: "mid" }],
    });
  }

  // Decoder: base, pin bed, bit ruler. Pins and field marks are dynamic.
  {
    const p = PLANS.decoder;
    const h = HEIGHTS.decoder;
    const bed: Plan = { x: p.x + 4, y: p.y + 10, w: 82, d: 14, r: 1.5 };
    const ruler: Plan = { x: p.x + 4, y: p.y + 28, w: 82, d: 5, r: 0.8 };
    const t = topTicks(ruler.x + 1.25, ruler.x + 81, 2.5, 4, ruler.y + 0.5, h + 0.6, [1.4, 3], P);
    const intake: Plan = { x: p.x + 4, y: p.y + 40, w: 22, d: 14, r: 2 };
    const rows = [0, 1, 2].map((i) => lineOnTop([intake.x + 30, intake.y + 3 + i * 4], [intake.x + 30 + [40, 28, 50][i], intake.y + 3 + i * 4], h, P));
    add({
      part: "decoder",
      key: "decoder",
      anchor: mid(p),
      halo: haloOf(p, 0, h, P),
      solids: [
        { paths: slabOf(p, 0, h, P, 6, 0.8), tone: "mid", inner: sideSeam(p, 3.5, P, 6) },
        { paths: slabOf(bed, h, 2, P, 4, 0.4), tone: "lo" },
        { paths: slabOf(ruler, h, 0.6, P, 3), tone: "lo", crease: "none" },
        { paths: slabOf(intake, h, 3, P, 4, 0.4), tone: "mid" },
      ],
      lines: [
        { d: t.minor, tone: "lo" },
        { d: t.major, tone: "mid" },
        { d: planOutline(insetPlan(intake, 3), h + 3, P, 3), tone: "faint" },
        { d: join(rows), tone: "lo", free: true },
      ],
      dots: [{ points: pointsAt(corners(p, 3).map(([x, y]) => [x, y, h] as Point3), P), size: 0.5, tone: "mid" }],
    });
  }

  // Control unit: six signal slots. Knobs are dynamic.
  {
    const p = PLANS.control;
    const h = HEIGHTS.control;
    const slots = Array.from({ length: 6 }, (_, i) => ({ x: p.x + 6 + i * 11, y: p.y + 6, w: 6, d: 32, r: 3 }) as Plan);
    const plate: Plan = { x: p.x + 3, y: p.y + 41, w: p.w - 6, d: 6, r: 1 };
    add({
      part: "control",
      key: "control",
      anchor: mid(p),
      halo: haloOf(p, 0, h, P),
      solids: [
        { paths: slabOf(p, 0, h, P, 6, 0.8), tone: "mid", inner: sideSeam(p, 4, P, 6) },
        { paths: slabOf(plate, h, 0.6, P, 3), tone: "lo", crease: "none" },
      ],
      lines: [
        { d: join(slots.map((s) => planOutline(s, h, P, 4))), tone: "lo" },
        { d: join(slots.map((s) => planOutline(insetPlan(s, 1.4), h, P, 4))), tone: "faint" },
        { d: topTicks(plate.x + 4, plate.x + plate.w - 4, 11, 1, plate.y + 0.6, h + 0.6, [2.2, 2.2], P).major, tone: "mid" },
      ],
      dots: [{ points: pointsAt(corners(p, 3).map(([x, y]) => [x, y, h] as Point3), P), size: 0.5, tone: "mid" }],
    });
  }

  // Register file cabinet. Drawers are dynamic.
  {
    const p = PLANS.regfile;
    const h = HEIGHTS.regfile;
    const top = insetPlan(p, 6);
    const handles = [p.x + 14, p.x + p.w - 14].map((x) => ({ x: x - 2, y: p.y + 8, w: 4, d: p.d - 16, r: 1.6 }) as Plan);
    add({
      part: "regfile",
      key: "regfile",
      anchor: mid(p),
      halo: haloOf(p, 0, h, P),
      solids: [
        { paths: slabOf(p, 0, h, P, 6, 0.8), tone: "mid", inner: sideSeam(p, h - 4, P, 6) },
        ...handles.map((plan) => ({ paths: slabOf(plan, h, 2.4, P, 4, 0.4), tone: "lo" as const })),
      ],
      lines: [{ d: planOutline(top, h, P, 4), tone: "faint" }],
      dots: [{ points: dotGrid(top.x + 18, top.y + 6, 10, 6, 4.4, h, P), size: 0.45, tone: "lo" }],
    });
  }

  // ALU: a chevron block, inputs on the notched side, result out the point.
  {
    const h = HEIGHTS.alu;
    const top = ALU_RING.map(([x, y]) => [x + (x < 120 ? 3 : -3), y + (y < 50 ? 3 : -3)] as Plane);
    add({
      part: "alu",
      key: "alu",
      anchor: [120, 50],
      halo: extrude(ALU_RING, 0, h, P, { convex: false }).fill,
      solids: [{ paths: extrude(ALU_RING, 0, h, P, { convex: false, bevel: 0.8 }), tone: "hi" }],
      lines: [
        { d: onTop(top, h, P, true), tone: "faint" },
        { d: join([[104, 33], [104, 67], [138, 50]].map(([x, y]) => ring(x, y, 3.2, h, P, 20))), tone: "lo" },
      ],
      dots: [{ points: pointsAt([[104, 33, h], [104, 67, h], [138, 50, h]], P), size: 0.7, tone: "mid" }],
    });
  }

  // Memory interface: controller with heat-sink fins, socket and a memory module.
  {
    const p = PLANS.memif;
    const h = HEIGHTS.memif;
    const fins = Array.from({ length: 10 }, (_, i) => ({ x: p.x + 6 + i * 8, y: p.y + 6, w: 2.4, d: p.d - 12, r: 0.6 }) as Plan);
    const s = PLANS.socket;
    const stick: Plan = { x: s.x + 4, y: s.y + 3.5, w: s.w - 8, d: 3, r: 0.5 };
    const chips = Array.from({ length: 6 }, (_, i) => ({ x: stick.x + 3 + i * 11.6, y: stick.y + 3, w: 9.4, d: 1, r: 0.3 }) as Plan);
    const latch = [s.x - 3, s.x + s.w - 1].map((x) => ({ x, y: s.y + 1, w: 4, d: 8, r: 1 }) as Plan);
    add({
      part: "memif",
      key: "memory",
      anchor: mid(s),
      halo: haloOf(s, 0, 6, P),
      solids: [
        { paths: slabOf(s, 0, 6, P, 3, 0.4), tone: "lo" },
        ...latch.map((plan) => ({ paths: slabOf(plan, 0, 9, P, 3, 0.3), tone: "mid" as const })),
        { paths: slabOf(stick, 6, 30, P, 2), tone: "mid", inner: sideSeam(stick, 10, P, 2) },
        ...chips.map((plan) => ({ paths: slabOf(plan, 14, 13, P, 2), tone: "lo" as const })),
      ],
      lines: [{ d: planOutline(insetPlan(s, 1.2), 6, P, 3), tone: "faint" }],
      dots: [],
    });
    add({
      part: "memif",
      key: "memif",
      anchor: mid(p),
      halo: haloOf(p, 0, h, P),
      solids: [
        { paths: slabOf(p, 0, h, P, 6, 0.8), tone: "mid", inner: sideSeam(p, 3.5, P, 6) },
        ...[...fins].sort((a, b) => depth(a.x, a.y) - depth(b.x, b.y)).map((f) => ({ paths: slabOf(f, h, 6, P, 2, 0.3), tone: "lo" as const })),
      ],
      lines: [],
      dots: [{ points: pointsAt(corners(p, 3).map(([x, y]) => [x, y, h] as Point3), P), size: 0.5, tone: "mid" }],
    });
  }

  // Write-back mux: a small selector with a lever slot.
  {
    const p = PLANS.mux;
    const h = HEIGHTS.mux;
    add({
      part: "datapath",
      key: "mux",
      anchor: mid(p),
      halo: haloOf(p, 0, h, P),
      solids: [{ paths: slabOf(p, 0, h, P, 4, 0.5), tone: "mid" }],
      lines: [{ d: planOutline({ x: p.x + 3, y: p.y + 4.6, w: 8, d: 2.8, r: 1.4 }, h, P, 3), tone: "lo" }],
      dots: [],
    });
  }

  // Board parts (capacitors, crystal) sort with the modules but never lift.
  for (const [x, y] of caps) {
    add({ part: "board", key: `cap${x},${y}`, anchor: [x, y], halo: "", solids: [{ paths: cylinder(x, y, 2.6, 0, 5.2, P, 20), tone: "lo", inner: sideArc(x, y, 2.6, 1.4, P, 16) }], lines: [{ d: ring(x, y, 1.3, 5.2, P, 14), tone: "faint" }], dots: [] });
  }
  add({ part: "board", key: "crystal", anchor: [crystal.x + 7, crystal.y + 3], halo: "", solids: [{ paths: slabOf(crystal, 0, 3.6, P, 6, 0.4), tone: "mid", inner: sideSeam(crystal, 1.2, P, 6) }], lines: [], dots: [] });

  // Explode: lift each module by its depth.
  modules.sort((a, b) => a.depth - b.depth);
  const lifted = modules.filter((m) => m.part !== "board");
  // Three layers: the board's interconnect stays down, the core (fetch,
  // decode, control, registers, ALU) rises one step and the memory hierarchy
  // (caches, memory interface), which sits at the back, rises two. Farther
  // layers rise higher, so on screen they move away from the layer in front.
  const memorySide = new Set<string>(["icache", "dcache", "memif"]);
  lifted.forEach((m) => (m.lift = memorySide.has(m.part) ? 64 : 30));

  return {
    P,
    board: { feet, boardSlab, groove, screwRings, screws, stripSlab, ticks, labelSlab, labelLine, labelText, labelRules, labelScrews, haloBoard: haloOf(BOARD, BOARD_Z, BOARD_H, P) },
    traces: traces.sort((a, b) => a.depth - b.depth),
    viaRings,
    modules,
  };
}

export type FigureArt = ReturnType<typeof buildFigure>;

// --- Dynamic parts: rebuilt when the machine state changes (not per frame) ---

export function drawersOf(plan: Plan, h: number, cols: number, rows: number, P: Projection) {
  const gap = 1.2;
  const w = (plan.w - 8 - gap * (cols - 1)) / cols;
  const rowH = (h - 6) / rows;
  const out: { index: number; paths: SolidPaths; pull: string; col: number; row: number; slide: Flat }[] = [];
  const face = plan.y + plan.d;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x = plan.x + 4 + c * (w + gap);
      const z = 3 + r * rowH;
      const front: Plan = { x, y: face, w, d: 1.3, r: 0.4 };
      out.push({
        index: c * rows + r,
        col: c,
        row: r,
        paths: slabOf(front, z, rowH - 0.9, P, 2, 0.3),
        // A closed pull slot on the drawer front: an outline has no loose ends.
        pull: (() => {
          const cx = x + w / 2;
          const cz = z + (rowH - 0.9) / 2;
          const a = Math.min(4, w / 5);
          const b = Math.min(0.6, (rowH - 0.9) / 5);
          const yy = face + 1.3;
          return pathOf([iso([cx - a, yy, cz - b], P), iso([cx + a, yy, cz - b], P), iso([cx + a, yy, cz + b], P), iso([cx - a, yy, cz + b], P)], true);
        })(),
        slide: [0, 0],
      });
    }
  }
  return out;
}

export function pinsOf(word: number, P: Projection) {
  const p = PLANS.decoder;
  const h = HEIGHTS.decoder + 2;
  const out: { bit: number; one: boolean; paths: SolidPaths; cap: string }[] = [];
  for (let i = 0; i < 32; i++) {
    const bit = 31 - i;
    const one = ((word >>> bit) & 1) === 1;
    const x = p.x + 5.25 + i * 2.5;
    const y = p.y + 17;
    const ph = one ? 4.6 : 1.1;
    out.push({ bit, one, paths: cylinder(x, y, 0.95, h, ph, P, 12), cap: ring(x, y, 0.45, h + ph, P, 8) });
  }
  // Paint order: sort by depth along the row.
  return out.sort((a, b) => depthOf([31 - a.bit, 0, 0], P) - depthOf([31 - b.bit, 0, 0], P));
}

/** Field dividers on the pin bed for an instruction's encoding (bit boundaries). */
export function fieldMarksOf(bounds: number[], P: Projection) {
  const p = PLANS.decoder;
  const z = HEIGHTS.decoder + 2;
  return bounds
    .map((bit) => {
      const i = 31 - bit; // boundary on the left side of this bit's pin
      const x = p.x + 4 + i * 2.5;
      return lineOnTop([x, p.y + 10], [x, p.y + 24], z, P);
    })
    .join("");
}

export function needleOf(pcSlot: number, P: Projection) {
  const dial = { x: -161, y: 46 };
  const z = HEIGHTS.fetch + 6.2;
  const angle = (pcSlot / 16) * Math.PI * 2;
  const tip: Plane = [dial.x + Math.sin(angle) * 14.5, dial.y - Math.cos(angle) * 14.5];
  const tail: Plane = [dial.x - Math.sin(angle) * 4, dial.y + Math.cos(angle) * 4];
  return lineOnTop(tail, tip, z, P);
}

export function knobsOf(P: Projection) {
  const p = PLANS.control;
  const h = HEIGHTS.control;
  return Array.from({ length: 6 }, (_, i) => {
    const plan: Plan = { x: p.x + 6 + i * 11 - 0.5, y: p.y + 7, w: 7, d: 7, r: 1.6 };
    return { paths: slabOf(plan, h, 3.4, P, 3, 0.4), groove: lineOnTop([plan.x + 1.6, plan.y + 3.5], [plan.x + 5.4, plan.y + 3.5], h + 3.4, P) };
  });
}

export function muxLeverOf(fromMemory: boolean, P: Projection) {
  const p = PLANS.mux;
  const x = p.x + (fromMemory ? 5 : 9);
  return cylinder(x, p.y + 6, 1.3, HEIGHTS.mux, 3.2, P, 14);
}

export function cachePinsOf(plan: Plan, h: number, lines: { valid: boolean; dirty: boolean }[], P: Projection) {
  const pins: { paths: SolidPaths; lit: boolean; depth: number }[] = [];
  lines.forEach((l, i) => {
    const x = plan.x + plan.w - 12;
    const y = plan.y + 9 + i * 8;
    pins.push({ paths: cylinder(x, y, 1.4, h, l.valid ? 3.2 : 0.8, P, 14), lit: false, depth: depthOf([x, y, 0], P) });
    pins.push({ paths: cylinder(x + 5, y, 1.4, h, l.dirty ? 3.2 : 0.8, P, 14), lit: l.dirty, depth: depthOf([x + 5, y, 0], P) });
  });
  return pins.sort((a, b) => a.depth - b.depth);
}
