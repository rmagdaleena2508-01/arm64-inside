import * as React from "react";
import { PARTS, PART_BY_ID } from "../content/parts";
import { ProcessorFigure, type View } from "../figure/ProcessorFigure";
import { WIDTH, HEIGHT, buildFigure } from "../figure/geometry";
import { Plate } from "../kit/react/draw";
import { useStillness } from "../kit/react/live";
import { fieldsOf, parseProgram, regName, word, type Instr } from "../sim/isa";
import { STAGES, buildTrace, pipelineOf, show, type Frame, type Part, type Stage } from "../sim/machine";
import { PROGRAMS } from "../sim/programs";
import { PipelineChart } from "./PipelineChart";

type Mode = "explore" | "execute" | "pipeline" | "datapath";
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "explore", label: "Explore", hint: "Click any part of the model to inspect it." },
  { id: "execute", label: "Execute", hint: "Step through each instruction, one stage at a time." },
  { id: "pipeline", label: "Pipeline", hint: "See instructions overlap in a five-stage pipeline." },
  { id: "datapath", label: "Datapath", hint: "Follow operands and results along the wires." },
];
const STAGE_NAME: Record<Stage, string> = { IF: "Fetch", ID: "Decode", EX: "Execute", MEM: "Memory", WB: "Write back" };
const STAGE_PARTS: Record<Stage, Part[]> = { IF: ["fetch", "icache"], ID: ["decoder", "control", "regfile"], EX: ["alu"], MEM: ["dcache"], WB: ["regfile"] };
const SPEEDS = [0.5, 1, 2, 4];

export function ProcessorExplorer() {
  const still = useStillness();
  const [mode, setMode] = React.useState<Mode>("execute");
  const [programId, setProgramId] = React.useState(PROGRAMS[0].id);
  const [source, setSource] = React.useState(PROGRAMS[0].source);
  const parsed = React.useMemo(() => parseProgram(source), [source]);
  const trace = React.useMemo(() => buildTrace(parsed.instrs), [parsed]);
  const pipe = React.useMemo(() => pipelineOf(parsed.instrs), [parsed]);
  const [index, setIndex] = React.useState(0);
  const [cycle, setCycle] = React.useState(-1);
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(1);
  const [selected, setSelected] = React.useState<Part | null>(null);
  const [hovered, setHovered] = React.useState<Part | null>(null);
  const [exploded, setExploded] = React.useState(false);
  const [azimuth, setAzimuth] = React.useState(45);
  const [view, setView] = React.useState<View>({ zoom: 1, cx: WIDTH / 2, cy: HEIGHT / 2 });
  const art = React.useMemo(() => buildFigure(azimuth), [azimuth]);
  const live = React.useRef<HTMLDivElement>(null);

  const last = trace.frames.length - 1;
  const lastCycle = pipe.cycles - 1;
  const stepping = mode === "pipeline" ? "cycle" : "frame";

  React.useEffect(() => {
    setIndex(0);
    setCycle(-1);
    setPlaying(false);
  }, [trace]);

  // Pipeline mode: build a frame for the current cycle from the same trace.
  const pipeFrame = React.useMemo<Frame>(() => {
    const base = trace.frames[0];
    if (cycle < 0) return base;
    const parts = new Set<Part>();
    let committed = -1;
    pipe.rows.forEach((row) => {
      const s = row.cells[cycle];
      if (s && s !== "stall") STAGE_PARTS[s].forEach((p) => parts.add(p));
      if (row.wb <= cycle) committed = row.instr;
    });
    // Architectural state: everything up to the last instruction that finished write-back.
    const wbFrame = committed >= 0 ? trace.frames.find((fr) => fr.instr === committed && fr.stage === "WB") : base;
    const fetching = pipe.rows.find((r) => r.cells[cycle] === "IF");
    const machine = { ...(wbFrame ?? base).machine, pc: fetching ? BigInt(0x400000 + fetching.instr * 4 + 4) : (wbFrame ?? base).machine.pc };
    const justWritten = pipe.rows.find((r) => r.wb === cycle);
    return {
      ...(wbFrame ?? base),
      stage: null,
      parts: [...parts],
      buses: [],
      machine,
      changed: justWritten ? { reg: wbFrame?.changed.reg } : {},
      note: "",
    };
  }, [cycle, pipe, trace]);

  const frame = mode === "pipeline" ? pipeFrame : trace.frames[index];
  const instr = frame.instr >= 0 ? parsed.instrs[frame.instr] : null;

  // Playback
  React.useEffect(() => {
    if (!playing) return;
    const atEnd = stepping === "cycle" ? cycle >= lastCycle : index >= last;
    if (atEnd) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => {
      if (stepping === "cycle") setCycle((c) => Math.min(c + 1, lastCycle));
      else setIndex((i) => Math.min(i + 1, last));
    }, (still ? 900 : 1100) / speed);
    return () => window.clearTimeout(id);
  }, [playing, index, cycle, speed, last, lastCycle, stepping, still]);

  const step = (d: number) => {
    setPlaying(false);
    if (stepping === "cycle") setCycle((c) => Math.max(-1, Math.min(lastCycle, c + d)));
    else setIndex((i) => Math.max(0, Math.min(last, i + d)));
  };
  const reset = () => {
    setPlaying(false);
    setIndex(0);
    setCycle(-1);
  };
  const resetView = () => {
    setView({ zoom: 1, cx: WIDTH / 2, cy: HEIGHT / 2 });
    setAzimuth(45);
    setExploded(false);
    setSelected(null);
  };
  const zoomBy = (factor: number) => setView((v) => ({ ...v, zoom: Math.max(1, Math.min(4, +(v.zoom * factor).toFixed(2))) }));

  const pick = (p: Part | null) => {
    setSelected((cur) => (p === cur ? null : p));
  };

  // Announce changes for screen readers (not every frame of motion, only steps).
  React.useEffect(() => {
    if (!live.current) return;
    if (mode === "pipeline") live.current.textContent = cycle < 0 ? "Pipeline reset" : `Cycle ${cycle + 1} of ${pipe.cycles}`;
    else live.current.textContent = frame.stage ? `${instr?.text}: ${STAGE_NAME[frame.stage]}. ${frame.note}` : frame.note;
  }, [frame, cycle, mode, instr, pipe.cycles]);

  const readout = hovered
    ? PART_BY_ID[hovered].name
    : mode === "pipeline"
      ? cycle < 0
        ? "reset"
        : `cycle ${cycle + 1} / ${pipe.cycles}`
      : frame.stage
        ? `${instr?.text} · ${frame.stage}`
        : frame.index === last && last > 0
          ? "done"
          : "reset";

  const prev = index > 0 ? trace.frames[index - 1].machine : null;
  const info = selected ? PART_BY_ID[selected] : null;
  const atStart = stepping === "cycle" ? cycle < 0 : index === 0;
  const atEnd = stepping === "cycle" ? cycle >= lastCycle : index >= last;

  return (
    <div className="explorer">
      <div className="mode-bar" role="tablist" aria-label="Explorer mode">
        {MODES.map((md) => (
          <button key={md.id} role="tab" aria-selected={mode === md.id} className="mode-tab" onClick={() => { setMode(md.id); setPlaying(false); if (md.id === "datapath" && index === 0) setIndex(1); }}>
            {md.label}
          </button>
        ))}
        <span className="mode-hint">{MODES.find((md) => md.id === mode)!.hint}</span>
      </div>

      <div className="iso explorer-figure" data-mode={mode}>
        <Plate fig="Fig. 5" title="Teaching processor · AArch64 subset" hint={exploded ? "Exploded view" : view.zoom > 1 ? "Drag to pan" : "Click a part"} readout={readout}>
          <ProcessorFigure art={art} frame={frame} instr={instr} selected={selected} exploded={exploded} view={view} onView={setView} onPick={pick} onHover={setHovered} />
        </Plate>
        <div className="view-tools" aria-label="View controls">
          <button onClick={() => setExploded((x) => !x)} aria-pressed={exploded}>{exploded ? "Assemble" : "Explode"}</button>
          <label className="angle">
            <span>Angle</span>
            <input type="range" min={30} max={60} step={5} value={azimuth} onChange={(ev) => setAzimuth(Number(ev.target.value))} aria-label="Rotate the model" />
            <span className="mono">{azimuth}°</span>
          </label>
          <button onClick={() => zoomBy(1.4)} aria-label="Zoom in">+</button>
          <button onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out" disabled={view.zoom <= 1}>−</button>
          <button onClick={resetView}>Reset view</button>
        </div>
        <ol className="part-keys" aria-label="Components">
          {PARTS.map((p) => (
            <li key={p.id}>
              <button aria-pressed={selected === p.id} data-active={frame.parts.includes(p.id) || (p.id === "datapath" && frame.buses.length > 0) ? "" : undefined} onClick={() => pick(p.id)} onMouseEnter={() => setHovered(p.id)} onMouseLeave={() => setHovered(null)}>
                <span className="mono num">{p.num}</span> {p.name}
              </button>
            </li>
          ))}
        </ol>
        <p className="figure-caption">
          A simplified educational processor that runs a small subset of AArch64 instructions. It is not the floor plan of any real chip: ARM64 is an instruction set, and every company that builds an ARM64 processor designs its own internals.
        </p>
      </div>

      <div className="sr-only" aria-live="polite" ref={live} />

      <div className="explorer-panels">
        {/* Program and transport */}
        <section className="panel" aria-label="Program">
          <header className="panel-head">
            <h4>Program</h4>
            <select value={programId} onChange={(ev) => { const p = PROGRAMS.find((x) => x.id === ev.target.value)!; setProgramId(p.id); setSource(p.source); }} aria-label="Sample program">
              {PROGRAMS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </header>
          <ol className="listing">
            {parsed.instrs.map((ins, n) => {
              const cur = mode === "pipeline" ? pipe.rows[n]?.cells[cycle] : frame.instr === n ? frame.stage : null;
              const done = mode === "pipeline" ? (pipe.rows[n]?.wb ?? 99) < cycle : frame.instr > n || (frame.instr === n && frame.stage === "WB");
              return (
                <li key={n} data-current={cur ? "" : undefined} data-done={done ? "" : undefined}>
                  <span className="mono addr">{(0x400000 + n * 4).toString(16).toUpperCase()}</span>
                  <span className="mono code">{ins.text}</span>
                  <span className="mono stage-tag">{cur ?? (done ? "✓" : "")}</span>
                </li>
              );
            })}
          </ol>
          {parsed.errors.length ? <p className="error">Line {parsed.errors[0].line}: {parsed.errors[0].error}</p> : null}
          {trace.error ? <p className="error">{trace.error.message}</p> : null}
          <p className="muted small">{PROGRAMS.find((p) => p.id === programId)?.blurb} Write your own in the Learning Lab below.</p>
          <div className="transport" aria-label="Playback controls">
            <button onClick={reset} aria-label="Reset" disabled={atStart}>⏮</button>
            <button onClick={() => step(-1)} aria-label="Step backward" disabled={atStart}>◀</button>
            <button className="primary" onClick={() => { if (atEnd) reset(); setPlaying((p) => !p); }} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚ Pause" : "▶ Play"}</button>
            <button onClick={() => step(1)} aria-label="Step forward" disabled={atEnd}>▶</button>
            <label className="speed">
              <span className="muted small">Speed</span>
              <select value={speed} onChange={(ev) => setSpeed(Number(ev.target.value))} aria-label="Execution speed">
                {SPEEDS.map((s) => (
                  <option key={s} value={s}>{s}×</option>
                ))}
              </select>
            </label>
          </div>
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${(stepping === "cycle" ? (cycle + 1) / Math.max(1, pipe.cycles) : index / Math.max(1, last)) * 100}%` }} />
          </div>
        </section>

        {/* Middle: what is happening */}
        <section className="panel" aria-label="Current step">
          {mode === "pipeline" ? (
            <PipelineChart instrs={parsed.instrs} pipe={pipe} cycle={cycle} onCycle={(c) => { setPlaying(false); setCycle(c); }} />
          ) : info && mode === "explore" ? (
            <Inspector partId={info.id} />
          ) : (
            <StageView frame={frame} instr={instr} mode={mode} />
          )}
        </section>

        {/* Registers */}
        <section className="panel" aria-label="Registers">
          <header className="panel-head">
            <h4>Registers</h4>
            <span className="muted small mono">PC {"0x" + frame.machine.pc.toString(16).toUpperCase()}</span>
          </header>
          <div className="regs">
            {frame.machine.x.slice(0, 16).map((v, r) => {
              const changed = mode !== "pipeline" ? frame.changed.reg === r : frame.changed.reg === r;
              const differs = prev && mode !== "pipeline" ? prev.x[r] !== v : false;
              return (
                <div key={r} className="reg" data-changed={changed || differs ? "" : undefined} data-zero={v === 0n ? "" : undefined}>
                  <span className="mono rn">{regName(r)}</span>
                  <span className="mono rv">{show(v)}</span>
                </div>
              );
            })}
          </div>
          <p className="muted small">Showing X0–X15 of the 31 registers. X16–X30 stay 0 in these programs. Values are shown as signed decimal.</p>
          {selected && mode !== "explore" ? <Inspector partId={selected} compact /> : null}
        </section>
      </div>
    </div>
  );
}

function StageView({ frame, instr, mode }: { frame: Frame; instr: Instr | null; mode: Mode }) {
  const instrText = instr?.text;
  if (!frame.stage) {
    return (
      <>
        <header className="panel-head"><h4>Ready</h4></header>
        <p>{frame.note || "Press Play or Step to run the program."}</p>
        <StageStrip current={null} />
        <p className="muted small">Each instruction passes through five stages in this teaching model. Registers change only in write-back.</p>
      </>
    );
  }
  const fields = instr && frame.stage === "ID" ? fieldsOf(instr) : null;
  return (
    <>
      <header className="panel-head">
        <h4>{STAGE_NAME[frame.stage]}</h4>
        <span className="mono small">{instrText}</span>
      </header>
      <StageStrip current={frame.stage} />
      <p>{frame.note}</p>
      {frame.error ? <p className="error">{frame.error}</p> : null}
      {Object.keys(frame.values).length ? (
        <dl className="wires" data-emph={mode === "datapath" ? "" : undefined}>
          {Object.entries(frame.values).map(([k, v]) => (
            <div key={k}>
              <dt className="mono">{k}</dt>
              <dd className="mono">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {mode === "datapath" ? (
        <p className="muted small">Lit traces: {frame.buses.length ? frame.buses.map((b) => b.replace("-", " → ")).join(", ") : "none this stage"}.</p>
      ) : null}
      {fields ? (
        <div className="fields">
          <p className="muted small mono">{word(frame.word)}</p>
          <div className="field-row">
            {fields.map((f) => (
              <div key={f.name} className="field" style={{ flexGrow: f.hi - f.lo + 1 }}>
                <span className="mono bits">{((frame.word >>> f.lo) & ((1 << (f.hi - f.lo + 1)) - 1)).toString(2).padStart(f.hi - f.lo + 1, "0")}</span>
                <span className="mono fname">{f.name}</span>
                <span className="fmean">{f.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {frame.signals && frame.stage === "ID" ? (
        <ul className="signals">
          {(["Reg2Loc", "ALUSrc", "MemToReg", "RegWrite", "MemRead", "MemWrite"] as const).map((s) => {
            const v = frame.signals![s];
            const on = s === "ALUSrc" ? v === "imm" : Boolean(v);
            return (
              <li key={s} data-on={on ? "" : undefined}>
                <span className="mono">{s}</span> <span className="mono">{s === "ALUSrc" ? String(v) : on ? "1" : "0"}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}

function StageStrip({ current }: { current: Stage | null }) {
  return (
    <ol className="stage-strip" aria-label="Pipeline stages">
      {STAGES.map((s) => (
        <li key={s} data-on={current === s ? "" : undefined}>
          <span className="mono">{s}</span>
          <span className="small">{STAGE_NAME[s]}</span>
        </li>
      ))}
    </ol>
  );
}

export function Inspector({ partId, compact = false }: { partId: Part; compact?: boolean }) {
  const p = PART_BY_ID[partId];
  return (
    <div className="inspector" data-compact={compact ? "" : undefined}>
      <header className="panel-head">
        <h4><span className="mono num">{p.num}</span> {p.name}</h4>
        <span className="mono small stage-pill">{p.stage}</span>
      </header>
      <p>{p.purpose}</p>
      {compact ? null : <p className="muted small">{p.object}</p>}
      <div className="io">
        <div>
          <h5>Inputs</h5>
          <ul>{p.inputs.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div>
          <h5>Outputs</h5>
          <ul>{p.outputs.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </div>
      <h5>In instruction execution</h5>
      <p>{p.role}</p>
      {compact ? null : (
        <p className="note"><strong>Simplified.</strong> {p.real}</p>
      )}
    </div>
  );
}
