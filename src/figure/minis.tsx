// Small isometric illustrations drawn with the Anatomy kit, one per idea:
// chips, boards, devices. Static, built once per kind.
import * as React from "react";
import { boxCorners, corners, cylinder, depthOf, fitProjection, insetPlan, iso, pathOf, planOutline, pointsAt, sideSeam, slabOf, topTicks, type Plan, type Point3, type Projection } from "../kit/iso-kit";
import { Dots, Line, Solid } from "../kit/react/draw";

export type MiniKind = "chip" | "board" | "venture" | "licence" | "phone" | "laptop" | "server" | "chip64" | "car" | "sensor" | "ai" | "cloud";

const W = 220;
const H = 150;

type El = React.ReactElement;

function pins(plan: Plan, z: number, count: number, P: Projection, lit = false): El[] {
  // Gull-wing pins on the two visible sides of a package.
  const out: El[] = [];
  const step = plan.w / (count + 1);
  for (let i = 1; i <= count; i++) {
    const x = plan.x + i * step;
    out.push(<Solid key={`py${i}`} paths={slabOf({ x: x - 0.8, y: plan.y + plan.d, w: 1.6, d: 4, r: 0.2 }, z, 0.8, P, 2)} tone={lit ? "hi" : "mid"} crease="none" />);
  }
  const stepY = plan.d / (count + 1);
  for (let i = 1; i <= count; i++) {
    const y = plan.y + i * stepY;
    out.push(<Solid key={`px${i}`} paths={slabOf({ x: plan.x + plan.w, y: y - 0.8, w: 4, d: 1.6, r: 0.2 }, z, 0.8, P, 2)} tone={lit ? "hi" : "mid"} crease="none" />);
  }
  return out;
}

function chip(P: Projection, plan: Plan, h: number, n: number, lit: boolean): El {
  const die = insetPlan(plan, plan.w * 0.28);
  return (
    <g key="chip">
      <path className="iso-halo" d={slabOf(plan, 0, h, P).fill} />
      {pins(plan, 0.6, n, P)}
      <Solid paths={slabOf(plan, 0, h, P, 3, 0.6)} tone="hi" lit={lit} />
      <Line d={planOutline(die, h, P, 2)} tone="mid" />
      <Line d={planOutline(insetPlan(die, 2), h, P, 2)} tone="faint" />
      <Dots points={pointsAt([[plan.x + 4, plan.y + 4, h]], P)} size={0.9} tone="mid" />
    </g>
  );
}

function build(kind: MiniKind) {
  const pts: Point3[] = [];
  const parts: (P: Projection) => El[] = (() => {
    switch (kind) {
      case "chip":
      case "chip64": {
        const plan: Plan = { x: -26, y: -26, w: 52, d: 52, r: 2 };
        pts.push(...boxCorners({ ...plan, w: plan.w + 4, d: plan.d + 4 }, 0, 6));
        return (P) => [chip(P, plan, 5, kind === "chip" ? 8 : 12, kind === "chip64")];
      }
      case "board": {
        const board: Plan = { x: -60, y: -36, w: 120, d: 72, r: 3 };
        const kb: Plan = { x: -54, y: 6, w: 80, d: 24, r: 2 };
        pts.push(...boxCorners(board, -4, 18));
        return (P) => {
          const keys: El[] = [];
          for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) keys.push(<Solid key={`${r}-${c}`} paths={slabOf({ x: kb.x + 3 + c * 7.6, y: kb.y + 3 + r * 7, w: 6, d: 5.6, r: 0.8 }, 3, 1.6, P, 2)} tone="mid" crease="none" />);
          return [
            <path key="h" className="iso-halo" d={slabOf(board, -4, 4, P).fill} />,
            <Solid key="b" paths={slabOf(board, -4, 4, P, 4, 0.8)} tone="mid" />,
            <Solid key="k" paths={slabOf(kb, 0, 3, P, 3)} tone="lo" />,
            ...keys,
            chip(P, { x: 4, y: -28, w: 24, d: 24, r: 1 }, 4, 5, true),
            <Solid key="c2" paths={slabOf({ x: -50, y: -28, w: 16, d: 12, r: 1 }, 0, 3, P, 2)} tone="lo" />,
            <Solid key="c3" paths={slabOf({ x: -28, y: -28, w: 16, d: 12, r: 1 }, 0, 3, P, 2)} tone="lo" />,
          ];
        };
      }
      case "venture": {
        // Three blocks joined on one plate: Acorn, Apple, VLSI Technology.
        const plate: Plan = { x: -60, y: -30, w: 120, d: 60, r: 4 };
        pts.push(...boxCorners(plate, -3, 22));
        return (P) => [
          <path key="h" className="iso-halo" d={slabOf(plate, -3, 3, P).fill} />,
          <Solid key="p" paths={slabOf(plate, -3, 3, P, 6, 0.8)} tone="lo" />,
          ...[-44, -10, 24].map((x, i) => <Solid key={i} paths={slabOf({ x, y: -14, w: 22, d: 22, r: 2 }, 0, 10 + i * 4, P, 3, 0.5)} tone={i === 1 ? "hi" : "mid"} lit={i === 1} />),
        ];
      }
      case "licence": {
        // A die design (the IP) beside three different packages built from it.
        const sheet: Plan = { x: -62, y: -20, w: 40, d: 40, r: 1 };
        pts.push(...boxCorners({ x: -62, y: -30, w: 124, d: 64, r: 1 }, 0, 10));
        return (P) => [
          <Solid key="s" paths={slabOf(sheet, 0, 0.8, P, 2)} tone="hi" lit />,
          <Line key="g" d={[0, 1, 2, 3].map((i) => planOutline({ x: sheet.x + 4 + (i % 2) * 17, y: sheet.y + 4 + Math.floor(i / 2) * 17, w: 15, d: 15, r: 0.5 }, 0.8, P, 2)).join("")} tone="mid" />,
          chip(P, { x: -8, y: -26, w: 20, d: 20, r: 1 }, 4, 4, false),
          <g key="c2">{chip(P, { x: 28, y: -26, w: 26, d: 26, r: 1 }, 4, 5, false)}</g>,
          <g key="c3">{chip(P, { x: 8, y: 8, w: 22, d: 22, r: 1 }, 5, 4, false)}</g>,
        ];
      }
      case "phone": {
        const body: Plan = { x: -18, y: -36, w: 36, d: 72, r: 6 };
        pts.push(...boxCorners(body, 0, 5));
        return (P) => [
          <path key="h" className="iso-halo" d={slabOf(body, 0, 4, P).fill} />,
          <Solid key="b" paths={slabOf(body, 0, 4, P, 8, 0.6)} tone="mid" inner={<Line d={sideSeam(body, 2, P, 8)} tone="faint" />} />,
          <Solid key="s" paths={slabOf(insetPlan(body, 2.4), 4, 0.4, P, 8)} tone="hi" lit crease="none" />,
          <Line key="n" d={planOutline({ x: -5, y: -32, w: 10, d: 2.4, r: 1.2 }, 4.4, P, 4)} tone="lo" />,
        ];
      }
      case "laptop": {
        const base: Plan = { x: -48, y: -30, w: 96, d: 60, r: 3 };
        pts.push(...boxCorners(base, 0, 4), [base.x, base.y, 58], [base.x + base.w, base.y, 58]);
        return (P) => {
          const lid: Plan = { x: base.x, y: base.y - 3, w: base.w, d: 3, r: 1 };
          return [
            <path key="h" className="iso-halo" d={slabOf(base, 0, 3, P).fill} />,
            <Solid key="lid" paths={slabOf(lid, 3, 56, P, 3)} tone="mid" />,
            <Solid key="b" paths={slabOf(base, 0, 3, P, 4, 0.6)} tone="mid" />,
            <Solid key="kb" paths={slabOf({ x: base.x + 8, y: base.y + 6, w: base.w - 16, d: 28, r: 1.5 }, 3, 0.4, P, 3)} tone="lo" crease="none" />,
            <Line key="tp" d={planOutline({ x: -14, y: base.y + 40, w: 28, d: 14, r: 2 }, 3, P, 3)} tone="lo" />,
            <Dots key="d" points={pointsAt(corners({ x: base.x + 8, y: base.y + 6, w: base.w - 16, d: 28, r: 0 }, 0).map(([x, y]) => [x, y, 3.4] as Point3), P)} size={0.5} tone="mid" />,
          ];
        };
      }
      case "server":
      case "cloud": {
        const rack: Plan = { x: -30, y: -30, w: 60, d: 60, r: 2 };
        const n = kind === "server" ? 5 : 6;
        pts.push(...boxCorners(rack, 0, n * 10 + 4));
        return (P) => [
          <path key="h" className="iso-halo" d={slabOf(rack, 0, 4, P).fill} />,
          ...Array.from({ length: n }, (_, i) => (
            <g key={i}>
              <Solid paths={slabOf(rack, i * 10, 9, P, 3, 0.5)} tone={i === 2 ? "hi" : "mid"} lit={i === 2} />
              <Dots points={pointsAt([0, 1, 2].map((k) => [rack.x + rack.w - 6 - k * 4, rack.y + rack.d, i * 10 + 4.5] as Point3), P)} size={0.7} tone={i === 2 ? "hi" : "lo"} />
            </g>
          )),
        ];
      }
      case "car": {
        const body: Plan = { x: -54, y: -24, w: 108, d: 48, r: 10 };
        const cabin: Plan = { x: -26, y: -20, w: 50, d: 40, r: 8 };
        pts.push(...boxCorners(body, 0, 34));
        return (P) => {
          const wheels = ([[-34, 24], [34, 24], [-34, -24], [34, -24]] as [number, number][]).sort((a, b) => depthOf([a[0], a[1], 0], P) - depthOf([b[0], b[1], 0], P));
          return [
            <path key="h" className="iso-halo" d={slabOf(body, 0, 4, P).fill} />,
            ...wheels.filter(([, y]) => y < 0).map(([x, y], i) => <Solid key={`wb${i}`} paths={cylinder(x, y, 9, 0, 4, P, 24)} tone="lo" />),
            <Solid key="b" paths={slabOf(body, 6, 12, P, 8, 0.8)} tone="mid" />,
            <Solid key="c" paths={slabOf(cabin, 18, 12, P, 8, 0.6)} tone="hi" />,
            ...wheels.filter(([, y]) => y > 0).map(([x, y], i) => <Solid key={`wf${i}`} paths={slabOf({ x: x - 9, y: y - 1, w: 18, d: 5, r: 2.4 }, 0, 14, P, 4)} tone="lo" />),
            chip(P, { x: -8, y: -8, w: 16, d: 16, r: 1 }, 2, 3, true),
          ].map((el, i) => (i === 0 ? el : el));
        };
      }
      case "sensor": {
        const board: Plan = { x: -40, y: -26, w: 80, d: 52, r: 4 };
        pts.push(...boxCorners(board, 0, 14));
        return (P) => [
          <path key="h" className="iso-halo" d={slabOf(board, 0, 3, P).fill} />,
          <Solid key="b" paths={slabOf(board, 0, 3, P, 6, 0.6)} tone="mid" />,
          <Dots key="s" points={pointsAt(corners(board, 4).map(([x, y]) => [x, y, 3] as Point3), P)} size={0.8} tone="mid" />,
          chip(P, { x: -20, y: -16, w: 22, d: 22, r: 1 }, 3, 4, true),
          <Solid key="ant" paths={cylinder(26, -14, 3, 3, 10, P, 18)} tone="hi" />,
          <Line key="t" d={topTicks(-34, 34, 4, 4, 18, 3, [1.4, 2.6], P).minor} tone="lo" />,
        ];
      }
      case "ai": {
        const board: Plan = { x: -60, y: -32, w: 120, d: 64, r: 3 };
        pts.push(...boxCorners(board, 0, 12));
        return (P) => [
          <path key="h" className="iso-halo" d={slabOf(board, 0, 3, P).fill} />,
          <Solid key="b" paths={slabOf(board, 0, 3, P, 4, 0.6)} tone="mid" />,
          <g key="cpu">{chip({ ...P }, { x: -52, y: -18, w: 30, d: 30, r: 1 }, 6, 5, true)}</g>,
          <g key="acc">{chip(P, { x: -4, y: -24, w: 52, d: 44, r: 1 }, 7, 9, false)}</g>,
          <Line key="bus" d={pathOf([iso([-22, -3, 3], P), iso([-4, -3, 3], P)])} tone="hi" />,
        ];
      }
    }
  })();
  const P = fitProjection(pts, W, H, { pad: 14, azimuth: 40 });
  return parts(P);
}

const cache = new Map<MiniKind, El[]>();

export function Mini({ kind, label }: { kind: MiniKind; label: string }) {
  const els = React.useMemo(() => {
    if (!cache.has(kind)) cache.set(kind, build(kind));
    return cache.get(kind)!;
  }, [kind]);
  return (
    <div className="iso mini">
      <svg className="iso-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {els}
      </svg>
    </div>
  );
}
