import { describe, expect, it } from "vitest";
import { bitmaskImm, encode, parseLine, parseProgram, word } from "./isa";
import { MEM_BASE, buildTrace, pipelineOf } from "./machine";

const SAMPLE = "MOV X0, #5\nMOV X1, #10\nADD X2, X0, X1\nSUB X3, X2, #3";

describe("sample program", () => {
  const { instrs, errors } = parseProgram(SAMPLE);
  const t = buildTrace(instrs);
  const last = t.frames[t.frames.length - 1].machine;

  it("parses cleanly", () => expect(errors).toEqual([]));
  it("gives X0=5, X1=10, X2=15, X3=12", () => {
    expect(last.x.slice(0, 4)).toEqual([5n, 10n, 15n, 12n]);
  });
  it("has X2=15 right after ADD writes back, before SUB", () => {
    const wb = t.frames.find((f) => f.instr === 2 && f.stage === "WB")!;
    expect(wb.machine.x[2]).toBe(15n);
    expect(wb.machine.x[3]).toBe(0n);
  });
  it("only writes a register at WB", () => {
    const ex = t.frames.find((f) => f.instr === 2 && f.stage === "EX")!;
    expect(ex.machine.x[2]).toBe(0n);
  });
  it("makes 5 frames per instruction plus reset", () => expect(t.frames.length).toBe(1 + 4 * 5));
  it("advances the PC by 4", () => expect(last.pc).toBe(0x400010n));
});

describe("encodings match the A64 machine words", () => {
  const enc = (s: string) => {
    const r = parseLine(s)!;
    if (!r.ok) throw new Error(r.error);
    return word(encode(r.instr));
  };
  it.each([
    ["MOV X0, #5", "0xD28000A0"],
    ["ADD X2, X0, X1", "0x8B010002"],
    ["SUB X3, X2, #3", "0xD1000C43"],
    ["MOV X1, X2", "0xAA0203E1"],
    ["MOV X0, #0xFF0000", "0xD2A01FE0"],
    ["MOV X0, #-1", "0x92800000"],
    ["ORR X0, X1, #0xFF", "0xB2401C20"],
    ["AND X3, X4, X5", "0x8A050083"],
    ["LDR X1, [X2, #8]", "0xF9400441"],
    ["STR X1, [X2]", "0xF9000041"],
    ["ADD X0, X1, #4096", "0x91400420"],
  ])("%s → %s", (src, w) => expect(enc(src)).toBe(w));
});

describe("validation", () => {
  const bad = (s: string) => {
    const r = parseLine(s);
    return r && !r.ok ? r.error : null;
  };
  it("rejects unsupported ops", () => expect(bad("MUL X0, X1, X2")).toMatch(/subset/));
  it("rejects out-of-range ADD immediates", () => expect(bad("ADD X0, X1, #5000")).toMatch(/out of range/));
  it("rejects non-bitmask logical immediates", () => expect(bad("AND X0, X1, #5")).toMatch(/logical immediate/));
  it("rejects misaligned offsets", () => expect(bad("LDR X0, [X1, #4]")).toMatch(/multiple of 8/));
  it("rejects W registers", () => expect(bad("ADD W0, W1, W2")).toMatch(/W registers/));
  it("rejects MOV values that need MOVK", () => expect(bad("MOV X0, #0x12345")).toMatch(/MOVK/));
  it("knows bitmask patterns", () => {
    expect(bitmaskImm(0x5555555555555555n)).not.toBeNull();
    expect(bitmaskImm(5n)).toBeNull();
  });
});

describe("load and store through the data cache", () => {
  const src = `MOV X1, #${MEM_BASE}\nMOV X2, #42\nSTR X2, [X1, #8]\nLDR X3, [X1, #8]\nADD X4, X3, #1`;
  const { instrs, errors } = parseProgram(src);
  const t = buildTrace(instrs);
  const last = t.frames[t.frames.length - 1].machine;
  it("parses", () => expect(errors).toEqual([]));
  it("round-trips 42 and adds 1", () => expect(last.x[4]).toBe(43n));
  it("misses then hits in the D-cache", () => {
    const mems = t.frames.filter((f) => f.stage === "MEM" && f.cache).map((f) => f.cache!.hit);
    expect(mems).toEqual([false, true]);
  });
  it("keeps the store in the cache (write-back) until eviction", () => {
    expect(last.mem[1]).toBe(0n);
    expect(last.dcache[0].data[1]).toBe(42n);
    expect(last.dcache[0].dirty).toBe(true);
  });
  it("stalls once for the load-use hazard", () => expect(pipelineOf(instrs).stalls).toBe(1));
  it("reports out-of-range addresses", () => {
    const p = parseProgram("MOV X1, #8\nLDR X0, [X1]");
    expect(buildTrace(p.instrs).error?.message).toMatch(/outside/);
  });
});

describe("pipeline", () => {
  it("overlaps four ALU instructions in 8 cycles", () => {
    const p = pipelineOf(parseProgram(SAMPLE).instrs);
    expect(p.cycles).toBe(8);
    expect(p.stalls).toBe(0);
  });
});
