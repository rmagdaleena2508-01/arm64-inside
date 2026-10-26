import * as React from "react";
import { axisVector, type Flat } from "../kit/iso-kit";
import { Dots, FaceText, Line, Solid } from "../kit/react/draw";
import { fieldsOf, isMem, isMov, type Instr } from "../sim/isa";
import type { Frame, Part } from "../sim/machine";
import { CODE_BASE } from "../sim/machine";
import { HEIGHT, HEIGHTS, PLANS, WIDTH, cachePinsOf, drawersOf, fieldMarksOf, knobsOf, muxLeverOf, needleOf, pinsOf, type FigureArt } from "./geometry";

export interface View {
  zoom: number;
  cx: number; // zoom centre in viewBox units
  cy: number;
}

interface Props {
  art: FigureArt;
  frame: Frame;
  instr: Instr | null;
  selected: Part | null;
  exploded: boolean;
  view: View;
  onView: (v: View) => void;
  onPick: (p: Part | null) => void;
  onHover: (p: Part | null) => void;
}

const px = ([x, y]: Flat, k: number) => `translate(${(x * k).toFixed(2)}px, ${(y * k).toFixed(2)}px)`;

export function ProcessorFigure({ art, frame, instr, selected, exploded, view, onView, onPick, onHover }: Props) {
  const { P } = art;
  const up = axisVector(P, [0, 0, 1]);
  const out = axisVector(P, [0, 1, 0]);
  const active = new Set(frame.parts);
  const buses = new Set(frame.buses);
  const stage = frame.stage;
  const sig = frame.signals;
  const m = frame.machine;

  // Explode needs headroom above the board: fit it by scaling the whole drawing.
  const maxLift = Math.max(...art.modules.map((mod) => mod.lift));
  const rise = exploded ? -up[1] * maxLift : 0;
  const fit = HEIGHT / (HEIGHT + rise);
  const ex = (WIDTH - WIDTH * fit) / 2;
  const ey = rise * fit;
  // User zoom k about (cx, cy) in fitted coordinates: r = k·(fit·p + e0 − c) + centre.
  const k = view.zoom;
  const a = fit * k;
  const e = k * (ex - view.cx) + WIDTH / 2;
  const f = k * (ey - view.cy) + HEIGHT / 2;
  const matrix = `matrix(${a.toFixed(4)}, 0, 0, ${a.toFixed(4)}, ${e.toFixed(2)}, ${f.toFixed(2)})`;

  // Dynamic parts, rebuilt only when the state changes.
  const word = frame.instr >= 0 && stage !== null ? frame.word : 0;
  const pins = React.useMemo(() => pinsOf(word, P), [word, P]);
  const marks = React.useMemo(() => {
    if (!instr || stage === null) return "";
    return fieldMarksOf(fieldsOf(instr).slice(1).map((fl) => fl.hi), P);
  }, [instr, stage, P]);
  const slot = Number((m.pc - CODE_BASE) / 4n);
  const needle = React.useMemo(() => needleOf(slot, P), [slot, P]);
  const knobs = React.useMemo(() => knobsOf(P), [P]);
  const iDrawers = React.useMemo(() => drawersOf(PLANS.icache, HEIGHTS.icache, 1, 4, P), [P]);
  const dDrawers = React.useMemo(() => drawersOf(PLANS.dcache, HEIGHTS.dcache, 1, 4, P), [P]);
  const rDrawers = React.useMemo(() => drawersOf(PLANS.regfile, HEIGHTS.regfile, 4, 8, P), [P]);
  const iPins = cachePinsOf(PLANS.icache, HEIGHTS.icache, m.icache, P);
  const dPins = cachePinsOf(PLANS.dcache, HEIGHTS.dcache, m.dcache, P);
  const fromMemory = Boolean(sig?.MemToReg && stage === "WB");
  const lever = React.useMemo(() => muxLeverOf(fromMemory, P), [fromMemory, P]);

  const signalOn = (name: keyof NonNullable<Frame["signals"]>) => {
    if (!sig || stage === null || stage === "IF") return false;
    if (name === "ALUSrc") return sig.ALUSrc === "imm";
    return Boolean(sig[name]);
  };
  const KNOBS: (keyof NonNullable<Frame["signals"]>)[] = ["Reg2Loc", "ALUSrc", "MemToReg", "RegWrite", "MemRead", "MemWrite"];

  // Registers read in ID and written in WB.
  const reads = new Set<number>();
  if (instr && stage === "ID") {
    if (isMem(instr)) {
      reads.add(instr.rn);
      if (instr.op === "STR") reads.add(instr.rt);
    } else {
      if (!isMov(instr)) reads.add(instr.rn);
      if (instr.src.kind === "reg") reads.add(instr.src.r);
    }
  }
  const written = stage === "WB" ? frame.changed.reg : undefined;

  const drawerSlide = (amount: number) => ({ transform: px(out, amount), transition: "transform 420ms var(--anatomy-ease)" });
  const cacheLine = (side: "I" | "D") => (frame.cache && frame.cache.side === side ? frame.cache.line : -1);

  const dyn = (key: string) => {
    switch (key) {
      case "icache":
      case "dcache": {
        const side = key === "icache" ? "I" : "D";
        const line = cacheLine(side);
        const drawers = key === "icache" ? iDrawers : dDrawers;
        const pinsOn = key === "icache" ? iPins : dPins;
        const ordered = [...drawers].sort((p, q) => (p.index === line ? 1 : 0) - (q.index === line ? 1 : 0) || p.row - q.row);
        return (
          <>
            {pinsOn.map((pin, i) => (
              <Solid key={i} paths={pin.paths} tone={pin.lit ? "hi" : "mid"} lit={pin.lit} />
            ))}
            {ordered.map((d) => (
              <g key={d.index} style={drawerSlide(d.index === line ? 5 : 0)} data-line={d.index}>
                <Solid paths={d.paths} tone={d.index === line ? "hi" : "mid"} lit={d.index === line} />
                <Line d={d.pull} tone={d.index === line ? "hi" : "lo"} />
              </g>
            ))}
          </>
        );
      }
      case "fetch":
        return <Line d={needle} tone="lit" className="proc-needle" free />;
      case "decoder":
        return (
          <>
            {pins.map((pin) => (
              <Solid key={pin.bit} paths={pin.paths} tone={pin.one ? "hi" : "lo"} lit={pin.one && stage === "ID"} crease="none" />
            ))}
            {marks ? <Line d={marks} tone="mid" /> : null}
          </>
        );
      case "control":
        return knobs.map((kn, i) => {
          const on = signalOn(KNOBS[i]);
          return (
            <g key={i} style={drawerSlide(on ? 18 : 0)}>
              <Solid paths={kn.paths} tone={on ? "hi" : "mid"} lit={on} />
              <Line d={kn.groove} tone={on ? "hi" : "lo"} />
            </g>
          );
        });
      case "regfile": {
        const order = [...rDrawers].sort((p, q) => {
          const w = (d: typeof p) => (d.index === written ? 2 : reads.has(d.index) ? 1 : 0);
          return w(p) - w(q) || p.row - q.row;
        });
        return order.map((d) => {
          const zr = d.index === 31;
          const isW = d.index === written;
          const isR = reads.has(d.index);
          return (
            <g key={d.index} style={drawerSlide(isW ? 4.5 : isR ? 2.4 : 0)} data-reg={zr ? "XZR" : `X${d.index}`}>
              <Solid paths={d.paths} tone={zr ? "lo" : isW || isR ? "hi" : "mid"} lit={isW} />
              {zr ? null : <Line d={d.pull} tone={isW || isR ? "hi" : "lo"} />}
            </g>
          );
        });
      }
      case "mux":
        return <Solid paths={lever} tone={stage === "WB" ? "hi" : "mid"} lit={stage === "WB" && sig?.RegWrite} />;
      default:
        return null;
    }
  };

  // Pointer: click picks a part, drag pans when zoomed.
  const svgRef = React.useRef<SVGSVGElement>(null);
  const drag = React.useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const partAt = (target: EventTarget | null) => {
    const el = (target as Element | null)?.closest?.("[data-part]") as HTMLElement | null;
    const p = el?.dataset.part;
    return p && p !== "board" ? (p as Part) : null;
  };
  const onPointerDown = (ev: React.PointerEvent) => {
    if (view.zoom <= 1) return;
    drag.current = { x: ev.clientX, y: ev.clientY, cx: view.cx, cy: view.cy, moved: false };
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
  };
  const onPointerMove = (ev: React.PointerEvent) => {
    if (!drag.current) {
      onHover(partAt(ev.target));
      return;
    }
    const rect = svgRef.current!.getBoundingClientRect();
    const scale = WIDTH / rect.width / view.zoom;
    const dx = (ev.clientX - drag.current.x) * scale;
    const dy = (ev.clientY - drag.current.y) * scale;
    if (Math.abs(dx) + Math.abs(dy) > 2) {
      drag.current.moved = true;
      setDragging(true);
    }
    onView({ ...view, cx: drag.current.cx - dx, cy: drag.current.cy - dy });
  };
  const onPointerUp = (ev: React.PointerEvent) => {
    const moved = drag.current?.moved;
    drag.current = null;
    setDragging(false);
    if (!moved) onPick(partAt(ev.target));
  };

  return (
    <svg
      ref={svgRef}
      className="iso-svg proc"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="An isometric model of a simplified teaching processor on a circuit board: instruction cache, fetch unit with a program counter dial, a decoder with 32 bit pins, a control unit with six signal switches, a 32-drawer register file, a chevron-shaped ALU, a data cache, a memory controller with a memory module, and copper traces connecting them."
      data-focus={selected ? "" : undefined}
      data-zoomed={view.zoom > 1 ? "" : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => onHover(null)}
      style={{ touchAction: view.zoom > 1 ? "none" : "pan-y" }}
    >
      <g className="proc-world" style={{ transform: matrix, transformOrigin: "0 0", transition: dragging ? "none" : "transform 700ms var(--anatomy-ease)" }}>
        {/* Board */}
        <g data-part="board" data-dim={selected ? "" : undefined}>
          <path className="iso-halo" d={art.board.haloBoard} />
          {art.board.feet.map((parts, i) => (
            <g key={i}>
              <Solid paths={parts[0]} tone="lo" />
              <Solid paths={parts[1]} tone="mid" />
            </g>
          ))}
          <Solid paths={art.board.boardSlab} tone="mid" />
          <Line d={art.board.groove} tone="lo" />
          <Line d={art.board.screwRings} tone="lo" />
          <Dots points={art.board.screws} size={0.55} tone="mid" />
          <Solid paths={art.board.stripSlab} tone="lo" crease="none" />
          <Line d={art.board.ticks.minor} tone="lo" />
          <Line d={art.board.ticks.major} tone="mid" />
          <Solid paths={art.board.labelSlab} tone="lo" crease="none" />
          <Line d={art.board.labelLine} tone="faint" />
          <FaceText transform={art.board.labelText} size={3.6} tone="mid">
            AArch64 · teaching model
          </FaceText>
          <Line d={art.board.labelRules} tone="lo" free />
          <Dots points={art.board.labelScrews} size={0.45} tone="mid" />
        </g>
        {/* Traces */}
        {art.traces.map((t) => {
          const on = t.bus === "wb" ? buses.has("alu-regfile") || buses.has("dcache-regfile") : buses.has(t.bus);
          return (
            <g key={t.bus} data-part="datapath" data-bus={t.bus} data-active={on ? "" : undefined} data-dim={selected && selected !== "datapath" ? "" : undefined}>
              {t.strips.map((s, i) => (
                <Solid key={i} paths={s} tone="mid" crease="none" />
              ))}
              <Line d={t.center} tone={on ? "lit" : "mid"} flow={on} className="proc-trace" />
              <Dots points={t.ends} size={1.1} tone={on ? "hi" : "lo"} />
              {t.vias.length ? <Dots points={t.vias} size={0.9} tone="mid" /> : null}
            </g>
          );
        })}
        <g data-part="datapath" data-dim={selected && selected !== "datapath" ? "" : undefined}>
          <Line d={art.viaRings} tone="lo" />
        </g>
        {/* Halos stay on the board when the modules lift */}
        <g data-dim={selected ? "" : undefined}>
          {art.modules
            .filter((mod) => mod.halo)
            .map((mod) => (
              <path key={mod.key} className="iso-halo proc-halo" d={mod.halo} style={{ opacity: exploded ? 0.55 : undefined }} />
            ))}
        </g>
        {/* Modules, far to near */}
        {art.modules.map((mod) => {
          const isOn = mod.part !== "board" && active.has(mod.part as Part);
          const dim = selected ? mod.part !== selected : false;
          return (
            <g
              key={mod.key}
              data-part={mod.part}
              data-key={mod.key}
              data-active={isOn ? "" : undefined}
              data-selected={selected === mod.part ? "" : undefined}
              data-dim={dim ? "" : undefined}
              style={{ transform: px(up, exploded ? mod.lift : 0), transition: "transform 900ms var(--anatomy-ease), opacity 300ms" }}
            >
              {mod.solids.map((s, i) => (
                <Solid key={i} paths={s.paths} tone={s.tone} crease={s.crease} flat={s.flat} lit={i === 0 && (selected === mod.part || (mod.key === "alu" && isOn))} inner={s.inner ? <Line d={s.inner} tone="faint" /> : undefined} />
              ))}
              {mod.lines.map((l, i) => (
                <Line key={i} d={l.d} tone={l.tone} free={l.free} />
              ))}
              {mod.dots.map((d, i) => (
                <Dots key={i} points={d.points} size={d.size} tone={d.tone} />
              ))}
              {dyn(mod.key)}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
