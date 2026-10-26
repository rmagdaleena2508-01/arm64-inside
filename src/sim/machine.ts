// The single deterministic execution model. Every view (figure, register
// readout, pipeline chart, memory explorer) reads from the trace built here.
//
// Teaching model, not a real core:
// - one instruction moves through five stages (IF, ID, EX, MEM, WB);
// - registers are written at WB, memory at MEM;
// - caches are tiny, direct-mapped, write-back and write-allocate. Real cache
//   sizes, policies and timings depend on the processor implementation.

import { MASK64, XZR, encode, isMem, isMov, regName, type Instr } from "./isa";

export const CODE_BASE = 0x400000n;
export const MEM_BASE = 0x1000;
export const MEM_WORDS = 32; // 256 bytes of simulated data memory
export const CACHE_LINES = 4;
export const LINE_BYTES = 16;

export type Stage = "IF" | "ID" | "EX" | "MEM" | "WB";
export const STAGES: Stage[] = ["IF", "ID", "EX", "MEM", "WB"];

export type Part = "icache" | "fetch" | "decoder" | "control" | "regfile" | "alu" | "dcache" | "memif" | "datapath";

export type Bus =
  | "mem-icache" // main memory → I-cache (refill)
  | "icache-fetch"
  | "fetch-decoder"
  | "decoder-control"
  | "decoder-regfile"
  | "regfile-alu"
  | "imm-alu" // immediate from decoder to ALU
  | "control-alu"
  | "alu-dcache"
  | "regfile-dcache" // store data
  | "dcache-mem" // D-cache ↔ memory interface
  | "dcache-regfile" // load result back
  | "alu-regfile"; // ALU result back

export interface CacheLine {
  valid: boolean;
  dirty: boolean;
  tag: number;
  data: bigint[]; // LINE_BYTES / 8 words
}

export interface Machine {
  x: bigint[]; // X0..X30
  pc: bigint;
  mem: bigint[]; // MEM_WORDS words from MEM_BASE
  dcache: CacheLine[];
  icache: CacheLine[];
  stats: { dHits: number; dMisses: number; iHits: number; iMisses: number; writebacks: number };
}

// Control signals named after the teaching datapath in Patterson & Hennessy's
// ARM edition. Real AArch64 cores generate many more internal controls.
export interface Signals {
  Reg2Loc: boolean;
  RegWrite: boolean;
  ALUSrc: "reg" | "imm";
  ALUOp: string;
  MemRead: boolean;
  MemWrite: boolean;
  MemToReg: boolean;
}

export interface Frame {
  index: number; // frame number in the trace
  instr: number; // instruction index, or -1 for the reset frame
  stage: Stage | null;
  pc: bigint; // address of this instruction
  word: number;
  machine: Machine; // state after this stage
  parts: Part[]; // active components
  buses: Bus[]; // active connections
  note: string; // what happens, in plain words
  values: Record<string, string>; // values on the wires this stage
  changed: { reg?: number; addr?: number; dLine?: number; iLine?: number };
  cache?: { side: "I" | "D"; hit: boolean; line: number; writeback?: boolean };
  signals?: Signals;
  error?: string;
}

const clone = (m: Machine): Machine => ({
  x: [...m.x],
  pc: m.pc,
  mem: [...m.mem],
  dcache: m.dcache.map((l) => ({ ...l, data: [...l.data] })),
  icache: m.icache.map((l) => ({ ...l, data: [...l.data] })),
  stats: { ...m.stats },
});

const emptyCache = () => Array.from({ length: CACHE_LINES }, () => ({ valid: false, dirty: false, tag: 0, data: [0n, 0n] }));

export function resetMachine(initial?: Partial<{ x: Record<number, bigint>; mem: Record<number, bigint> }>): Machine {
  const m: Machine = {
    x: Array.from({ length: 31 }, () => 0n),
    pc: CODE_BASE,
    mem: Array.from({ length: MEM_WORDS }, () => 0n),
    dcache: emptyCache(),
    icache: emptyCache(),
    stats: { dHits: 0, dMisses: 0, iHits: 0, iMisses: 0, writebacks: 0 },
  };
  for (const [r, v] of Object.entries(initial?.x ?? {})) m.x[Number(r)] = v & MASK64;
  for (const [a, v] of Object.entries(initial?.mem ?? {})) m.mem[(Number(a) - MEM_BASE) / 8] = v & MASK64;
  return m;
}

const read = (m: Machine, r: number) => (r === XZR ? 0n : m.x[r]);
export const signed = (v: bigint) => (v & (1n << 63n) ? v - (1n << 64n) : v);
export const show = (v: bigint) => {
  const s = signed(v);
  return s >= -9999999n && s <= 99999999n ? s.toString() : "0x" + v.toString(16).toUpperCase();
};

/** Split an address into cache line index, tag and word-in-line. */
export function cacheSlot(addr: number) {
  const block = Math.floor(addr / LINE_BYTES);
  return { line: block % CACHE_LINES, tag: Math.floor(block / CACHE_LINES), word: (addr % LINE_BYTES) / 8, base: block * LINE_BYTES };
}

// Data cache access against the simulated memory window.
function dAccess(m: Machine, addr: number, write?: bigint) {
  const { line, tag, word, base } = cacheSlot(addr);
  const l = m.dcache[line];
  const hit = l.valid && l.tag === tag;
  let writeback = false;
  if (!hit) {
    if (l.valid && l.dirty) {
      const oldBase = (l.tag * CACHE_LINES + line) * LINE_BYTES;
      l.data.forEach((w, i) => (m.mem[(oldBase - MEM_BASE) / 8 + i] = w));
      writeback = true;
      m.stats.writebacks++;
    }
    l.valid = true;
    l.dirty = false;
    l.tag = tag;
    l.data = [0, 1].map((i) => m.mem[(base - MEM_BASE) / 8 + i] ?? 0n);
    m.stats.dMisses++;
  } else m.stats.dHits++;
  let value = l.data[word];
  if (write !== undefined) {
    l.data[word] = write;
    l.dirty = true;
    value = write;
  }
  return { hit, line, value, writeback };
}

// Instruction cache: four 4-byte instructions per 16-byte line.
function iAccess(m: Machine, pc: bigint) {
  const offset = Number(pc - CODE_BASE);
  const block = Math.floor(offset / LINE_BYTES);
  const line = block % CACHE_LINES;
  const tag = Math.floor(block / CACHE_LINES);
  const l = m.icache[line];
  const hit = l.valid && l.tag === tag;
  if (!hit) {
    l.valid = true;
    l.tag = tag;
    m.stats.iMisses++;
  } else m.stats.iHits++;
  return { hit, line };
}

export function signalsOf(i: Instr): Signals {
  switch (i.op) {
    case "LDR":
      return { Reg2Loc: false, RegWrite: true, ALUSrc: "imm", ALUOp: "add (address)", MemRead: true, MemWrite: false, MemToReg: true };
    case "STR":
      return { Reg2Loc: true, RegWrite: false, ALUSrc: "imm", ALUOp: "add (address)", MemRead: false, MemWrite: true, MemToReg: false };
    case "MOV":
      return { Reg2Loc: false, RegWrite: true, ALUSrc: i.src.kind, ALUOp: "pass", MemRead: false, MemWrite: false, MemToReg: false };
    default:
      return { Reg2Loc: false, RegWrite: true, ALUSrc: i.src.kind, ALUOp: i.op.toLowerCase(), MemRead: false, MemWrite: false, MemToReg: false };
  }
}

/** Source registers an instruction reads in EX (for hazards) and at MEM (store data). */
export function sourcesOf(i: Instr): { ex: number[]; mem: number[] } {
  if (isMem(i)) return i.op === "LDR" ? { ex: [i.rn], mem: [] } : { ex: [i.rn], mem: [i.rt] };
  const regs: number[] = [];
  if (!isMov(i)) regs.push(i.rn);
  if (i.src.kind === "reg") regs.push(i.src.r);
  return { ex: regs.filter((r) => r !== XZR), mem: [] };
}

export const destOf = (i: Instr): number | null => (isMem(i) ? (i.op === "LDR" ? i.rt : null) : i.rd === XZR ? null : i.rd);

export interface Trace {
  frames: Frame[];
  error?: { instr: number; message: string };
}

export function buildTrace(instrs: Instr[], start: Machine = resetMachine()): Trace {
  let m = clone(start);
  const frames: Frame[] = [
    { index: 0, instr: -1, stage: null, pc: m.pc, word: 0, machine: clone(m), parts: [], buses: [], note: "Reset. The PC points at the first instruction.", values: {}, changed: {} },
  ];
  const push = (f: Omit<Frame, "index" | "machine">) => frames.push({ ...f, index: frames.length, machine: clone(m) });

  for (let n = 0; n < instrs.length; n++) {
    const i = instrs[n];
    const pc = m.pc;
    const w = encode(i);
    const sig = signalsOf(i);
    const base = { instr: n, pc, word: w, signals: sig };

    // IF
    const ic = iAccess(m, pc);
    m.pc = pc + 4n;
    push({
      ...base,
      stage: "IF",
      parts: ["fetch", "icache", ...(ic.hit ? [] : (["memif"] as Part[]))],
      buses: ic.hit ? ["icache-fetch"] : ["mem-icache", "icache-fetch"],
      note: `Fetch: the PC (${"0x" + pc.toString(16).toUpperCase()}) is sent to the instruction cache. ${ic.hit ? "Hit" : "Miss: the line is filled from main memory first"}. The 32-bit word ${"0x" + w.toString(16).toUpperCase().padStart(8, "0")} comes back and the PC moves on by 4.`,
      values: { PC: "0x" + pc.toString(16).toUpperCase(), word: "0x" + w.toString(16).toUpperCase().padStart(8, "0"), "next PC": "0x" + m.pc.toString(16).toUpperCase() },
      changed: { iLine: ic.line },
      cache: { side: "I", hit: ic.hit, line: ic.line },
    });

    // ID: read registers, generate control
    const values: Record<string, string> = { op: i.op };
    if (isMem(i)) {
      values[`${regName(i.rn)} (base)`] = show(read(m, i.rn));
      values.offset = "#" + i.offset.toString();
      if (i.op === "STR") values[`${regName(i.rt)} (data)`] = show(read(m, i.rt));
    } else {
      if (!isMov(i)) values[regName(i.rn)] = show(read(m, i.rn));
      if (i.src.kind === "reg") values[regName(i.src.r)] = show(read(m, i.src.r));
      else values.imm = "#" + show(i.src.value);
    }
    const readsRegs = isMem(i) || !isMov(i) || i.src.kind === "reg";
    push({
      ...base,
      stage: "ID",
      parts: ["decoder", "control", ...(readsRegs ? (["regfile"] as Part[]) : [])],
      buses: ["fetch-decoder", "decoder-control", ...(readsRegs ? (["decoder-regfile"] as Bus[]) : [])],
      note: `Decode: the decoder splits the word into fields. The control unit sets the signals for ${i.op}${readsRegs ? ", and the register file reads the source registers" : ""}.`,
      values,
      changed: {},
    });

    // EX
    let result = 0n;
    let address = 0;
    let exNote = "";
    const exValues: Record<string, string> = {};
    if (isMem(i)) {
      const b = read(m, i.rn);
      const a = (b + i.offset) & MASK64;
      exValues.address = `${show(b)} + ${i.offset} = 0x${a.toString(16).toUpperCase()}`;
      exNote = `Execute: the ALU adds the base register and the offset to form the address 0x${a.toString(16).toUpperCase()}.`;
      const aNum = Number(a);
      if (a > BigInt(MEM_BASE + MEM_WORDS * 8 - 8) || aNum < MEM_BASE) {
        push({ ...base, stage: "EX", parts: ["alu"], buses: ["regfile-alu", "imm-alu", "control-alu"], note: exNote, values: exValues, changed: {}, error: `Address 0x${a.toString(16).toUpperCase()} is outside the simulated memory (0x${MEM_BASE.toString(16).toUpperCase()}–0x${(MEM_BASE + MEM_WORDS * 8 - 1).toString(16).toUpperCase()}).` });
        return { frames, error: { instr: n, message: frames[frames.length - 1].error! } };
      }
      if (aNum % 8 !== 0) {
        push({ ...base, stage: "EX", parts: ["alu"], buses: ["regfile-alu", "imm-alu", "control-alu"], note: exNote, values: exValues, changed: {}, error: `Address 0x${a.toString(16).toUpperCase()} isn't 8-byte aligned. This simulator requires aligned accesses (real AArch64 hardware generally allows unaligned access to normal memory).` });
        return { frames, error: { instr: n, message: frames[frames.length - 1].error! } };
      }
      address = aNum;
    } else {
      const a = isMov(i) ? 0n : read(m, i.rn);
      const b = i.src.kind === "reg" ? read(m, i.src.r) : i.src.value;
      const sym = { MOV: "", ADD: "+", SUB: "−", AND: "AND", ORR: "OR" }[i.op];
      if (i.op === "MOV") result = b;
      if (i.op === "ADD") result = (a + b) & MASK64;
      if (i.op === "SUB") result = (a - b) & MASK64;
      if (i.op === "AND") result = a & b;
      if (i.op === "ORR") result = a | b;
      exValues.result = i.op === "MOV" ? `${show(b)} (passed through)` : `${show(a)} ${sym} ${show(b)} = ${show(result)}`;
      exNote = i.op === "MOV" ? `Execute: the value ${show(b)} passes through the ALU unchanged.` : `Execute: the ALU computes ${exValues.result}.`;
    }
    push({ ...base, stage: "EX", parts: ["alu", "control"], buses: ["regfile-alu", "control-alu", ...(sig.ALUSrc === "imm" ? (["imm-alu"] as Bus[]) : [])], note: exNote, values: exValues, changed: {} });

    // MEM
    if (isMem(i)) {
      const store = i.op === "STR" ? read(m, i.rt) : undefined;
      const r = dAccess(m, address, store);
      result = r.value;
      const where = `0x${address.toString(16).toUpperCase()}`;
      push({
        ...base,
        stage: "MEM",
        parts: ["dcache", ...(r.hit ? [] : (["memif"] as Part[]))],
        buses: [i.op === "STR" ? "regfile-dcache" : "alu-dcache", ...(i.op === "STR" ? (["alu-dcache"] as Bus[]) : []), ...(r.hit ? [] : (["dcache-mem"] as Bus[]))],
        note: `Memory: the data cache is checked for ${where}. ${r.hit ? "Hit." : `Miss: ${r.writeback ? "the old dirty line is written back, then " : ""}the line is filled from main memory.`} ${i.op === "STR" ? `The value ${show(store!)} is written into the cache line (marked dirty).` : `The value ${show(r.value)} is read.`}`,
        values: { address: where, [i.op === "STR" ? "stored" : "loaded"]: show(r.value), cache: r.hit ? "hit" : "miss" },
        changed: { dLine: r.line, addr: i.op === "STR" ? address : undefined },
        cache: { side: "D", hit: r.hit, line: r.line, writeback: r.writeback },
      });
    } else {
      push({ ...base, stage: "MEM", parts: [], buses: [], note: `Memory: ${i.op} doesn't access memory, so the result just passes through this stage.`, values: { result: show(result) }, changed: {} });
    }

    // WB
    const rd = destOf(i);
    if (rd !== null) m.x[rd] = result;
    push({
      ...base,
      stage: "WB",
      parts: rd !== null ? ["regfile"] : [],
      buses: rd !== null ? [i.op === "LDR" ? "dcache-regfile" : "alu-regfile"] : [],
      note: rd !== null ? `Write back: ${regName(rd)} ← ${show(result)}.` : `Write back: a store writes no register.`,
      values: rd !== null ? { [regName(rd)]: show(result) } : {},
      changed: { reg: rd ?? undefined },
    });
  }
  return { frames };
}

/** Index of the last frame before (or at) which instruction n has completed WB. */
export const committedAfter = (t: Trace, n: number) => t.frames.findIndex((f) => f.instr === n && f.stage === "WB");

// --- Pipeline schedule (teaching model: full forwarding, one load-use stall) ---

export interface PipeRow {
  instr: number;
  cells: Record<number, Stage | "stall">; // cycle → stage
  wb: number; // cycle of write-back
}

export function pipelineOf(instrs: Instr[]): { rows: PipeRow[]; cycles: number; stalls: number } {
  const rows: PipeRow[] = [];
  let fetch = 0; // cycle this instruction enters IF
  let held = 0; // extra cycles it waits in IF behind a stalled instruction
  let stalls = 0;
  for (let n = 0; n < instrs.length; n++) {
    const prev = instrs[n - 1];
    const prevDest = prev && prev.op === "LDR" ? destOf(prev) : null;
    // A value loaded by the previous LDR is ready only after its MEM stage, one cycle too late for EX.
    const stall = prevDest !== null && sourcesOf(instrs[n]).ex.includes(prevDest) ? 1 : 0;
    const cells: Record<number, Stage | "stall"> = {};
    cells[fetch] = "IF";
    for (let s = 1; s <= held; s++) cells[fetch + s] = "stall";
    const id = fetch + held + 1;
    cells[id] = "ID";
    for (let s = 1; s <= stall; s++) cells[id + s] = "stall";
    cells[id + stall + 1] = "EX";
    cells[id + stall + 2] = "MEM";
    cells[id + stall + 3] = "WB";
    stalls += stall;
    rows.push({ instr: n, cells, wb: id + stall + 3 });
    fetch = id; // the next instruction is fetched while this one decodes
    held = stall;
  }
  const cycles = rows.length ? rows[rows.length - 1].wb + 1 : 0;
  return { rows, cycles, stalls };
}
