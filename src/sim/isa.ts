// A small, documented subset of AArch64 (A64) for teaching.
// Supported: MOV, ADD, SUB, AND, ORR, LDR, STR on 64-bit X registers.
// Every instruction is validated against the real A64 operand rules for the
// encoding it maps to, and encoded to its real 32-bit machine word.

export const MASK64 = (1n << 64n) - 1n;
export const XZR = 31;

export type Op = "MOV" | "ADD" | "SUB" | "AND" | "ORR" | "LDR" | "STR";

export type Source = { kind: "imm"; value: bigint } | { kind: "reg"; r: number };

export type MovInstr = { op: "MOV"; rd: number; src: Source; text: string };
export type AluInstr = { op: "ADD" | "SUB" | "AND" | "ORR"; rd: number; rn: number; src: Source; text: string };
export type MemInstr = { op: "LDR" | "STR"; rt: number; rn: number; offset: bigint; text: string };
export type Instr = MovInstr | AluInstr | MemInstr;

export const isMem = (i: Instr): i is MemInstr => i.op === "LDR" || i.op === "STR";
export const isMov = (i: Instr): i is MovInstr => i.op === "MOV";

export type ParseResult = { ok: true; instr: Instr } | { ok: false; error: string };

export const SUPPORTED: Op[] = ["MOV", "ADD", "SUB", "AND", "ORR", "LDR", "STR"];

export const regName = (r: number) => (r === XZR ? "XZR" : `X${r}`);

export function hex(value: bigint, digits = 16) {
  return "0x" + (value & MASK64).toString(16).toUpperCase().padStart(digits, "0");
}

function parseReg(token: string, role: string, allowZr = true): number | string {
  const t = token.trim().toUpperCase();
  if (t === "XZR") return allowZr ? XZR : `${role} can't be XZR here: in this encoding register 31 means SP, which this simulator doesn't model.`;
  if (t === "SP" || t === "WSP") return `SP isn't supported in this simulator. Use X0–X30.`;
  if (/^W([0-9]|[12][0-9]|30|ZR)$/.test(t)) return `32-bit W registers aren't supported here. Use the 64-bit X registers (X0–X30).`;
  const m = /^X([0-9]|[12][0-9]|30)$/.exec(t);
  if (!m) return `"${token.trim()}" isn't a register. Use X0–X30${allowZr ? " or XZR" : ""}.`;
  return Number(m[1]);
}

function parseImm(token: string): bigint | string {
  const t = token.trim();
  if (!t.startsWith("#")) return `Immediate values start with #, like #5.`;
  const body = t.slice(1).trim();
  const m = /^(-)?(0x[0-9a-f]+|[0-9]+)$/i.exec(body);
  if (!m) return `"${t}" isn't a valid immediate. Use decimal (#12) or hex (#0x1F).`;
  const magnitude = BigInt(m[2]);
  if (magnitude > MASK64) return `"${t}" doesn't fit in 64 bits.`;
  return m[1] ? -magnitude : magnitude;
}

// --- Immediate encodability, following the A64 rules ---

const ones = (k: number) => (1n << BigInt(k)) - 1n;
const rotr = (x: bigint, r: number, e: number) => {
  const mask = ones(e);
  if (r === 0) return x & mask;
  return ((x >> BigInt(r)) | (x << BigInt(e - r))) & mask;
};

/** ADD/SUB (immediate): a 12-bit unsigned value, optionally shifted left by 12. */
export function addSubImm(value: bigint): { imm12: number; shift: 0 | 1 } | null {
  if (value < 0n) return null;
  if (value <= 4095n) return { imm12: Number(value), shift: 0 };
  if ((value & 0xfffn) === 0n && value >> 12n <= 4095n) return { imm12: Number(value >> 12n), shift: 1 };
  return null;
}

/** Logical (bitmask) immediate: a rotated run of ones, replicated across 64 bits. */
export function bitmaskImm(value: bigint): { n: number; immr: number; imms: number } | null {
  const v = value & MASK64;
  if (v === 0n || v === MASK64) return null;
  for (const e of [2, 4, 8, 16, 32, 64]) {
    const elem = v & ones(e);
    let replicated = 0n;
    for (let i = 0; i < 64; i += e) replicated |= elem << BigInt(i);
    if (replicated !== v) continue;
    for (let k = 1; k < e; k++) {
      for (let immr = 0; immr < e; immr++) {
        if (rotr(ones(k), immr, e) === elem) {
          const imms = e === 64 ? k - 1 : (((~(e * 2 - 1)) & 0x3f) | (k - 1)) & 0x3f;
          return { n: e === 64 ? 1 : 0, immr, imms };
        }
      }
    }
    return null;
  }
  return null;
}

/** MOVZ/MOVN wide immediate: one 16-bit chunk at shift 0, 16, 32 or 48. */
export function wideImm(value: bigint): { inverted: boolean; imm16: number; hw: number } | null {
  const v = value & MASK64;
  for (const inverted of [false, true]) {
    const x = inverted ? ~v & MASK64 : v;
    for (let hw = 0; hw < 4; hw++) {
      const shift = BigInt(hw * 16);
      if ((x & ~(0xffffn << shift) & MASK64) === 0n) {
        if (inverted && hw > 0 && x === 0n) continue;
        return { inverted, imm16: Number((x >> shift) & 0xffffn), hw };
      }
    }
  }
  return null;
}

// --- Parser ---

const splitOperands = (rest: string) => {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of rest) {
    if (ch === "[") depth++;
    if (ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};

export function parseLine(raw: string): ParseResult | null {
  const line = raw.replace(/\/\/.*$|;.*$/, "").trim();
  if (!line) return null;
  const m = /^([a-z]+)\s*(.*)$/i.exec(line);
  if (!m) return { ok: false, error: `Can't read "${line}".` };
  const op = m[1].toUpperCase();
  const text = `${op} ${m[2].trim()}`.trim();
  if (!SUPPORTED.includes(op as Op)) {
    return { ok: false, error: `${op} isn't in this simulator's subset. Supported: ${SUPPORTED.join(", ")}. (The full A64 instruction set has hundreds more.)` };
  }
  const args = splitOperands(m[2]);
  const err = (e: string): ParseResult => ({ ok: false, error: e });
  const reg = (t: string | undefined, role: string, zr = true) => (t === undefined ? `Missing ${role}.` : parseReg(t, role, zr));

  if (op === "MOV") {
    if (args.length !== 2) return err(`MOV takes two operands: MOV Xd, #imm or MOV Xd, Xm.`);
    const rd = reg(args[0], "destination", false);
    if (typeof rd === "string") return err(rd);
    if (args[1].startsWith("#")) {
      const imm = parseImm(args[1]);
      if (typeof imm === "string") return err(imm);
      if (!wideImm(imm) && !bitmaskImm(imm)) {
        return err(`MOV can't build ${args[1]} in one instruction. A64 MOV needs a value that fits one 16-bit chunk (MOVZ/MOVN) or a bitmask pattern; real code builds other values with MOVZ + MOVK.`);
      }
      return { ok: true, instr: { op: "MOV", rd, src: { kind: "imm", value: imm & MASK64 }, text } };
    }
    const rm = reg(args[1], "source");
    if (typeof rm === "string") return err(rm);
    return { ok: true, instr: { op: "MOV", rd, src: { kind: "reg", r: rm }, text } };
  }

  if (op === "ADD" || op === "SUB" || op === "AND" || op === "ORR") {
    if (args.length !== 3) return err(`${op} takes three operands: ${op} Xd, Xn, Xm or ${op} Xd, Xn, #imm.`);
    if (args[2].toUpperCase().includes("LSL") || args.length > 3) return err(`Shifted operands aren't supported in this simulator.`);
    const logical = op === "AND" || op === "ORR";
    const isImm = args[2].startsWith("#");
    // Register 31: XZR in the register forms; SP for Rd of every immediate form and for Rn of ADD/SUB (immediate).
    const rd = reg(args[0], "destination", !isImm);
    if (typeof rd === "string") return err(rd);
    const rn = reg(args[1], "first source", !isImm || logical);
    if (typeof rn === "string") return err(rn);
    if (isImm) {
      const imm = parseImm(args[2]);
      if (typeof imm === "string") return err(imm);
      if (logical) {
        if (!bitmaskImm(imm)) return err(`${args[2]} isn't a valid logical immediate. ${op} (immediate) only encodes repeating runs of 1 bits, like #0xFF or #0xF0F0F0F0F0F0F0F0. Load other values into a register first.`);
      } else if (!addSubImm(imm)) {
        return err(imm < 0n
          ? `${op} (immediate) takes an unsigned value. Use ${op === "ADD" ? "SUB" : "ADD"} with #${-imm} instead.`
          : `${args[2]} is out of range. ${op} (immediate) takes 0–4095, or a multiple of 4096 up to 4095 × 4096.`);
      }
      return { ok: true, instr: { op, rd, rn, src: { kind: "imm", value: imm & MASK64 }, text } };
    }
    const rm = reg(args[2], "second source");
    if (typeof rm === "string") return err(rm);
    return { ok: true, instr: { op, rd, rn, src: { kind: "reg", r: rm }, text } };
  }

  // LDR / STR
  if (args.length !== 2) return err(`${op} takes a register and an address: ${op} Xt, [Xn] or ${op} Xt, [Xn, #imm].`);
  const rt = reg(args[0], "data register");
  if (typeof rt === "string") return err(rt);
  if (op === "LDR" && args[0].trim().toUpperCase() === "XZR") return err(`Loading into XZR discards the value; pick X0–X30.`);
  const addr = args[1].trim();
  if (/\]\s*!$/.test(addr) || /\]\s*,/.test(addr) || /^\[[^\]]*\]\s*,/.test(addr)) return err(`Pre- and post-indexed addressing aren't supported here. Use [Xn] or [Xn, #imm].`);
  const am = /^\[\s*([^,\]]+)\s*(?:,\s*([^\]]+))?\]$/.exec(addr);
  if (!am) return err(`The address must look like [Xn] or [Xn, #imm].`);
  const rn = reg(am[1], "base register", false);
  if (typeof rn === "string") return err(rn);
  let offset = 0n;
  if (am[2] !== undefined) {
    if (!am[2].trim().startsWith("#")) return err(`Register offsets aren't supported here. Use an immediate offset like [X1, #8].`);
    const imm = parseImm(am[2]);
    if (typeof imm === "string") return err(imm);
    if (imm < 0n || imm > 32760n || imm % 8n !== 0n) {
      return err(`For 64-bit ${op} with an unsigned offset, the offset must be a multiple of 8 from 0 to 32760. (A64 has LDUR/STUR for other offsets.)`);
    }
    offset = imm;
  }
  return { ok: true, instr: { op: op as MemInstr["op"], rt, rn, offset, text } };
}

// --- Encoder: the real A64 machine words ---

export function encode(i: Instr): number {
  const u = (x: number) => x >>> 0;
  switch (i.op) {
    case "MOV": {
      if (i.src.kind === "reg") return u(0xaa0003e0 | (i.src.r << 16) | i.rd);
      const w = wideImm(i.src.value);
      if (w) return u((w.inverted ? 0x92800000 : 0xd2800000) | (w.hw << 21) | (w.imm16 << 5) | i.rd);
      const b = bitmaskImm(i.src.value)!;
      return u(0xb2000000 | (b.n << 22) | (b.immr << 16) | (b.imms << 10) | (XZR << 5) | i.rd);
    }
    case "ADD":
    case "SUB": {
      if (i.src.kind === "reg") return u((i.op === "ADD" ? 0x8b000000 : 0xcb000000) | (i.src.r << 16) | (i.rn << 5) | i.rd);
      const a = addSubImm(i.src.value)!;
      return u((i.op === "ADD" ? 0x91000000 : 0xd1000000) | (a.shift << 22) | (a.imm12 << 10) | (i.rn << 5) | i.rd);
    }
    case "AND":
    case "ORR": {
      if (i.src.kind === "reg") return u((i.op === "AND" ? 0x8a000000 : 0xaa000000) | (i.src.r << 16) | (i.rn << 5) | i.rd);
      const b = bitmaskImm(i.src.value)!;
      return u((i.op === "AND" ? 0x92000000 : 0xb2000000) | (b.n << 22) | (b.immr << 16) | (b.imms << 10) | (i.rn << 5) | i.rd);
    }
    case "LDR":
    case "STR":
      return u((i.op === "LDR" ? 0xf9400000 : 0xf9000000) | (Number(i.offset / 8n) << 10) | (i.rn << 5) | i.rt);
  }
}

export const word = (w: number) => "0x" + w.toString(16).toUpperCase().padStart(8, "0");

/** Fields of the encoding, for the decoder view. Bit ranges are inclusive [hi, lo]. */
export function fieldsOf(i: Instr): { name: string; hi: number; lo: number; meaning: string }[] {
  const w = encode(i);
  const bits = (hi: number, lo: number) => (w >>> lo) & ((1 << (hi - lo + 1)) - 1);
  const r = (n: number) => `${n} → ${regName(n)}`;
  if (isMem(i)) {
    return [
      { name: "size", hi: 31, lo: 30, meaning: "11 → 64-bit access" },
      { name: "opcode", hi: 29, lo: 22, meaning: i.op === "LDR" ? "load, unsigned offset" : "store, unsigned offset" },
      { name: "imm12", hi: 21, lo: 10, meaning: `${bits(21, 10)} × 8 = ${bits(21, 10) * 8} byte offset` },
      { name: "Rn", hi: 9, lo: 5, meaning: r(bits(9, 5)) + " (base)" },
      { name: "Rt", hi: 4, lo: 0, meaning: r(bits(4, 0)) },
    ];
  }
  const sf = { name: "sf", hi: 31, lo: 31, meaning: "1 → 64-bit operation" };
  if (i.op === "MOV" && i.src.kind === "imm" && wideImm(i.src.value)) {
    const wv = wideImm(i.src.value)!;
    return [
      sf,
      { name: "opcode", hi: 30, lo: 23, meaning: wv.inverted ? "MOVN (move wide, inverted)" : "MOVZ (move wide, zero)" },
      { name: "hw", hi: 22, lo: 21, meaning: `shift left by ${bits(22, 21) * 16}` },
      { name: "imm16", hi: 20, lo: 5, meaning: `${bits(20, 5)}` },
      { name: "Rd", hi: 4, lo: 0, meaning: r(bits(4, 0)) },
    ];
  }
  const regForm = !isMem(i) && i.src.kind === "reg";
  if (regForm) {
    const name = i.op === "MOV" ? "ORR (shifted register), alias MOV" : `${i.op} (shifted register)`;
    return [
      sf,
      { name: "opcode", hi: 30, lo: 21, meaning: name },
      { name: "Rm", hi: 20, lo: 16, meaning: r(bits(20, 16)) },
      { name: "imm6", hi: 15, lo: 10, meaning: "0 → no shift" },
      { name: "Rn", hi: 9, lo: 5, meaning: r(bits(9, 5)) },
      { name: "Rd", hi: 4, lo: 0, meaning: r(bits(4, 0)) },
    ];
  }
  if (i.op === "ADD" || i.op === "SUB") {
    return [
      sf,
      { name: "opcode", hi: 30, lo: 23, meaning: `${i.op} (immediate)` },
      { name: "sh", hi: 22, lo: 22, meaning: bits(22, 22) ? "LSL #12" : "no shift" },
      { name: "imm12", hi: 21, lo: 10, meaning: `${bits(21, 10)}` },
      { name: "Rn", hi: 9, lo: 5, meaning: r(bits(9, 5)) },
      { name: "Rd", hi: 4, lo: 0, meaning: r(bits(4, 0)) },
    ];
  }
  return [
    sf,
    { name: "opcode", hi: 30, lo: 23, meaning: i.op === "MOV" ? "ORR (immediate), alias MOV" : `${i.op} (immediate)` },
    { name: "N", hi: 22, lo: 22, meaning: "bitmask element size" },
    { name: "immr", hi: 21, lo: 16, meaning: `rotate right ${bits(21, 16)}` },
    { name: "imms", hi: 15, lo: 10, meaning: "run length / element size" },
    { name: "Rn", hi: 9, lo: 5, meaning: r(bits(9, 5)) },
    { name: "Rd", hi: 4, lo: 0, meaning: r(bits(4, 0)) },
  ];
}

export type Program = { instrs: Instr[]; errors: { line: number; error: string }[] };

export function parseProgram(source: string): Program {
  const instrs: Instr[] = [];
  const errors: { line: number; error: string }[] = [];
  source.split("\n").forEach((raw, index) => {
    const result = parseLine(raw);
    if (!result) return;
    if (result.ok) instrs.push(result.instr);
    else errors.push({ line: index + 1, error: result.error });
  });
  return { instrs, errors };
}
