import * as React from "react";
import { MASK64, SUPPORTED, hex, parseProgram, regName } from "../sim/isa";
import { CACHE_LINES, LINE_BYTES, MEM_BASE, MEM_WORDS, buildTrace, cacheSlot, show, type Frame } from "../sim/machine";
import { Reveal, SectionHead } from "../ui";
import { KnowledgeQuiz } from "./Quiz";

const LAB_START = "// Store two numbers, load them back and add them\nMOV X1, #0x1000\nMOV X2, #7\nMOV X3, #35\nSTR X2, [X1]\nSTR X3, [X1, #8]\nLDR X4, [X1]\nLDR X5, [X1, #8]\nADD X6, X4, X5";

const SYNTAX: { op: string; forms: string[]; note: string }[] = [
  { op: "MOV", forms: ["MOV Xd, #imm", "MOV Xd, Xm"], note: "imm must fit one 16-bit chunk (MOVZ/MOVN) or be a bitmask pattern" },
  { op: "ADD", forms: ["ADD Xd, Xn, Xm", "ADD Xd, Xn, #imm"], note: "imm 0–4095, or a multiple of 4096 up to 4095 × 4096" },
  { op: "SUB", forms: ["SUB Xd, Xn, Xm", "SUB Xd, Xn, #imm"], note: "same immediate range as ADD" },
  { op: "AND", forms: ["AND Xd, Xn, Xm", "AND Xd, Xn, #imm"], note: "imm must be a logical (bitmask) immediate, e.g. #0xFF" },
  { op: "ORR", forms: ["ORR Xd, Xn, Xm", "ORR Xd, Xn, #imm"], note: "same immediate rules as AND" },
  { op: "LDR", forms: ["LDR Xt, [Xn]", "LDR Xt, [Xn, #imm]"], note: "loads 8 bytes; imm a multiple of 8, 0–32760" },
  { op: "STR", forms: ["STR Xt, [Xn]", "STR Xt, [Xn, #imm]"], note: "stores 8 bytes; same offsets as LDR" },
];

export function LearningLab() {
  return (
    <section id="lab" className="section">
      <div className="wrap">
        <SectionHead num="07" eyebrow="Interactive learning lab" title="From Instructions to Real-World Applications" lede="Three experiments: write and run your own ARM64 instructions, watch loads and stores move through a cache, then check what you've learned." />
        <InstructionSimulator />
        <MemoryExplorer />
        <KnowledgeQuiz />
      </div>
    </section>
  );
}

function InstructionSimulator() {
  const [source, setSource] = React.useState(LAB_START);
  const parsed = React.useMemo(() => parseProgram(source), [source]);
  const trace = React.useMemo(() => buildTrace(parsed.instrs), [parsed]);
  const commits = React.useMemo(() => trace.frames.filter((f) => f.stage === "WB"), [trace]);
  const [done, setDone] = React.useState(0);
  React.useEffect(() => setDone(0), [source]);
  const total = parsed.instrs.length;
  const runnable = parsed.errors.length === 0;
  const state = done === 0 ? trace.frames[0].machine : commits[done - 1]?.machine ?? trace.frames[trace.frames.length - 1].machine;
  const lastN = done - 1;
  const lastFrames = trace.frames.filter((f) => f.instr === lastN);
  const ex = lastFrames.find((f) => f.stage === "EX");
  const mem = lastFrames.find((f) => f.stage === "MEM");
  const wb = lastFrames.find((f) => f.stage === "WB");
  // The trace stops at a runtime error, so the last commit is the instruction before it.
  const errorAt = trace.error && done === commits.length ? trace.error : null;

  // Instruction builder
  const [op, setOp] = React.useState("ADD");
  const [a, setA] = React.useState("X7");
  const [b, setB] = React.useState("X4");
  const [c, setC] = React.useState("#1");
  const mem2 = op === "LDR" || op === "STR";
  const built = op === "MOV" ? `MOV ${a}, ${b}` : mem2 ? `${op} ${a}, [${b}${c && c !== "#0" ? `, ${c}` : ""}]` : `${op} ${a}, ${b}, ${c}`;
  const builtCheck = parseProgram(built);

  return (
    <Reveal className="lab card">
      <header className="lab-head">
        <span className="eyebrow">Lab 1</span>
        <h3 className="h3">ARM64 instruction simulator</h3>
        <p className="muted small">Supports a documented subset of A64: {SUPPORTED.join(", ")}, on X0–X30 and XZR. Data memory is 256 bytes at 0x1000–0x10FF. This is not the complete ARM64 instruction set.</p>
      </header>
      <div className="lab1">
        <div>
          <label className="small muted" htmlFor="lab-src">Program (one instruction per line, // for comments)</label>
          <textarea id="lab-src" className="mono editor" spellCheck={false} value={source} onChange={(e) => setSource(e.target.value)} rows={11} />
          {parsed.errors.map((e) => (
            <p key={e.line} className="error">Line {e.line}: {e.error}</p>
          ))}
          <div className="builder">
            <select value={op} onChange={(e) => { setOp(e.target.value); if (e.target.value === "LDR" || e.target.value === "STR") { setB("X1"); setC("#0"); } }} aria-label="Instruction">
              {SUPPORTED.map((o) => <option key={o}>{o}</option>)}
            </select>
            <input className="mono" value={a} onChange={(e) => setA(e.target.value)} aria-label="First operand" size={4} />
            <input className="mono" value={b} onChange={(e) => setB(e.target.value)} aria-label="Second operand" size={6} />
            {op !== "MOV" ? <input className="mono" value={c} onChange={(e) => setC(e.target.value)} aria-label="Third operand" size={6} /> : null}
            <button className="chip-btn" onClick={() => builtCheck.errors.length === 0 && setSource((s) => s.replace(/\s*$/, "") + "\n" + built)} disabled={builtCheck.errors.length > 0}>Add line</button>
          </div>
          <p className={builtCheck.errors.length ? "error" : "muted small mono"}>{builtCheck.errors.length ? builtCheck.errors[0].error : built}</p>
          <details className="syntax">
            <summary className="small">Supported syntax</summary>
            <ul>
              {SYNTAX.map((s) => (
                <li key={s.op}><span className="mono">{s.forms.join("  ·  ")}</span><span className="muted small"> {s.note}</span></li>
              ))}
            </ul>
          </details>
        </div>
        <div>
          <div className="transport">
            <button onClick={() => setDone(0)} disabled={done === 0}>Reset</button>
            <button onClick={() => setDone((d) => Math.max(0, d - 1))} disabled={done === 0} aria-label="Undo one instruction">◀</button>
            <button className="primary" onClick={() => setDone((d) => Math.min(commits.length, d + 1))} disabled={!runnable || done >= commits.length}>Step</button>
            <button onClick={() => setDone(commits.length)} disabled={!runnable || done >= commits.length}>Run all</button>
            <span className="mono small muted">{done} / {total}</span>
          </div>
          {errorAt ? <p className="error">Stopped at instruction {errorAt.instr + 1}: {errorAt.message}</p> : null}
          <div className="explain">
            {done === 0 ? (
              <p className="muted small">Press Step to run the first instruction.</p>
            ) : (
              <>
                <p className="mono small accent">{parsed.instrs[lastN]?.text}</p>
                {ex?.values.address ? <p className="small">Address: <span className="mono">{ex.values.address}</span></p> : null}
                {ex?.values.result ? <p className="small">ALU: <span className="mono">{ex.values.result}</span></p> : null}
                {mem?.cache ? <p className="small">Data cache: {mem.cache.hit ? "hit" : "miss"}{mem.cache.writeback ? ", dirty line written back" : ""} (line {mem.cache.line}).</p> : null}
                {wb ? <p className="small">{wb.note.replace("Write back: ", "")}</p> : null}
              </>
            )}
          </div>
          <RegisterGrid frameRegs={state.x} changed={wb?.changed.reg} />
          <MemoryGrid mem={state.mem} dcache={state.dcache} highlight={mem?.values.address ? Number(mem.values.address) : undefined} />
        </div>
      </div>
    </Reveal>
  );
}

function RegisterGrid({ frameRegs, changed }: { frameRegs: bigint[]; changed?: number }) {
  return (
    <div className="regs regs-4">
      {frameRegs.slice(0, 16).map((v, r) => (
        <div key={r} className="reg" data-changed={changed === r ? "" : undefined} data-zero={v === 0n ? "" : undefined}>
          <span className="mono rn">{regName(r)}</span>
          <span className="mono rv">{show(v)}</span>
        </div>
      ))}
    </div>
  );
}

/** Memory as the program sees it: the cache's copy wins when a line is valid and dirty. */
function MemoryGrid({ mem, dcache, highlight }: { mem: bigint[]; dcache: Frame["machine"]["dcache"]; highlight?: number }) {
  const view = mem.map((v, i) => {
    const addr = MEM_BASE + i * 8;
    const s = cacheSlot(addr);
    const l = dcache[s.line];
    const cached = l.valid && l.tag === s.tag;
    return { addr, value: cached ? l.data[s.word] : v, inCache: cached, stale: cached && l.dirty && l.data[s.word] !== v };
  });
  return (
    <div className="memgrid" aria-label="Data memory">
      {view.slice(0, 16).map((m) => (
        <div key={m.addr} className="memcell" data-hl={highlight === m.addr ? "" : undefined} data-cached={m.inCache ? "" : undefined}>
          <span className="mono addr">{m.addr.toString(16).toUpperCase()}</span>
          <span className="mono">{show(m.value)}</span>
        </div>
      ))}
      <p className="muted small span-all">First 16 words (0x1000–0x107F). Outlined cells are currently held in the data cache.</p>
    </div>
  );
}

// ---------------- Lab 2 ----------------

interface Access { op: "LDR" | "STR"; addr: number; value: number }

function MemoryExplorer() {
  const [log, setLog] = React.useState<Access[]>([
    { op: "STR", addr: 0x1008, value: 42 },
    { op: "LDR", addr: 0x1008, value: 0 },
    { op: "LDR", addr: 0x1048, value: 0 },
  ]);
  const [op, setOp] = React.useState<"LDR" | "STR">("LDR");
  const [addr, setAddr] = React.useState(0x1000);
  const [value, setValue] = React.useState("99");
  const valueOk = /^\d+$/.test(value) && Number(value) <= 65535;

  const source = log.map((a) => (a.op === "STR" ? `MOV X1, #0x${a.addr.toString(16)}\nMOV X2, #${a.value}\nSTR X2, [X1]` : `MOV X1, #0x${a.addr.toString(16)}\nLDR X3, [X1]`)).join("\n");
  const trace = React.useMemo(() => buildTrace(parseProgram(source).instrs), [source]);
  const final = trace.frames[trace.frames.length - 1].machine;
  const memFrames = trace.frames.filter((f) => f.stage === "MEM" && f.cache);
  const lastMem = memFrames[memFrames.length - 1];
  const s = cacheSlot(addr);
  const addrBits = (addr - 0).toString(2).padStart(16, "0");

  return (
    <Reveal className="lab card">
      <header className="lab-head">
        <span className="eyebrow">Lab 2</span>
        <h3 className="h3">Memory explorer</h3>
        <p className="muted small">Registers, a {CACHE_LINES}-line data cache ({LINE_BYTES}-byte lines, direct-mapped, write-back) and main memory. Real cache sizes, mappings and policies depend on the processor implementation, not on the ARM64 architecture.</p>
      </header>
      <div className="lab2-controls">
        <select value={op} onChange={(e) => setOp(e.target.value as "LDR" | "STR")} aria-label="Operation">
          <option value="LDR">LDR (load)</option>
          <option value="STR">STR (store)</option>
        </select>
        <select value={addr} onChange={(e) => setAddr(Number(e.target.value))} aria-label="Address" className="mono">
          {Array.from({ length: MEM_WORDS }, (_, i) => MEM_BASE + i * 8).map((a) => (
            <option key={a} value={a}>0x{a.toString(16).toUpperCase()}</option>
          ))}
        </select>
        {op === "STR" ? <input className="mono" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Value to store" size={7} /> : null}
        <button className="chip-btn primary-chip" disabled={op === "STR" && !valueOk} onClick={() => setLog((l) => [...l, { op, addr, value: Number(value) }])}>Run access</button>
        <button className="chip-btn" onClick={() => setLog([])}>Clear</button>
        {op === "STR" && !valueOk ? <span className="error">Enter a whole number from 0 to 65535.</span> : null}
      </div>
      <div className="addr-split">
        <span className="small muted">Address 0x{addr.toString(16).toUpperCase()} splits into</span>
        <span className="mono"><b data-f="tag">{addrBits.slice(0, 10)}</b><b data-f="idx">{addrBits.slice(10, 12)}</b><b data-f="off">{addrBits.slice(12)}</b></span>
        <span className="small"><span data-f="tag">tag {s.tag}</span> · <span data-f="idx">line {s.line}</span> · <span data-f="off">byte {addr % LINE_BYTES}</span></span>
      </div>
      <div className="hier">
        <div className="hier-col">
          <h5>Registers</h5>
          {[1, 2, 3].map((r) => (
            <div key={r} className="reg"><span className="mono rn">X{r}</span><span className="mono rv">{r === 1 ? hex(final.x[1] & MASK64, 4) : show(final.x[r])}</span></div>
          ))}
          <p className="muted small">X1 holds the address, X2 the value to store, X3 the value loaded.</p>
        </div>
        <div className="hier-arrow" aria-hidden="true">⇄</div>
        <div className="hier-col">
          <h5>Data cache</h5>
          <table className="cache-table">
            <thead><tr><th>Line</th><th>V</th><th>D</th><th>Tag</th><th>Words</th></tr></thead>
            <tbody>
              {final.dcache.map((l, i) => (
                <tr key={i} data-last={lastMem?.cache?.line === i ? "" : undefined}>
                  <td className="mono">{i}</td>
                  <td className="mono">{l.valid ? 1 : 0}</td>
                  <td className="mono" data-dirty={l.dirty ? "" : undefined}>{l.dirty ? 1 : 0}</td>
                  <td className="mono">{l.valid ? l.tag : "–"}</td>
                  <td className="mono small">{l.valid ? l.data.map((w) => show(w)).join(", ") : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small">Hits {final.stats.dHits} · misses {final.stats.dMisses} · write-backs {final.stats.writebacks}</p>
        </div>
        <div className="hier-arrow" aria-hidden="true">⇄</div>
        <div className="hier-col">
          <h5>Main memory</h5>
          <div className="memgrid memgrid-sm">
            {final.mem.map((v, i) => {
              const a = MEM_BASE + i * 8;
              const cs = cacheSlot(a);
              const l = final.dcache[cs.line];
              const cached = l.valid && l.tag === cs.tag;
              return (
                <div key={a} className="memcell" data-cached={cached ? "" : undefined} data-hl={lastMem && Number(lastMem.values.address) === a ? "" : undefined} data-stale={cached && l.dirty && l.data[cs.word] !== v ? "" : undefined}>
                  <span className="mono addr">{a.toString(16).toUpperCase()}</span>
                  <span className="mono">{show(v)}</span>
                </div>
              );
            })}
          </div>
          <p className="muted small">Outlined: also in the cache. Dashed: memory is stale because the cache holds a newer, dirty copy.</p>
        </div>
      </div>
      <ol className="access-log">
        {memFrames.map((f, i) => (
          <li key={i} data-hit={f.cache!.hit ? "" : undefined}>
            <span className="mono">{log[i]?.op} 0x{Number(f.values.address).toString(16).toUpperCase()}</span>
            <span className="mono">{f.cache!.hit ? "hit" : "miss"}</span>
            <span className="small muted">{f.note.replace(/^Memory: the/, "The")}</span>
          </li>
        ))}
        {memFrames.length === 0 ? <li className="muted small">No accesses yet. Run a load or store.</li> : null}
      </ol>
    </Reveal>
  );
}
