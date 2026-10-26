export const PROGRAMS = [
  {
    id: "arith",
    name: "Arithmetic",
    source: "MOV X0, #5\nMOV X1, #10\nADD X2, X0, X1\nSUB X3, X2, #3",
    blurb: "The sample from the brief. After ADD, X2 = 15. After SUB, X3 = 12.",
  },
  {
    id: "mem",
    name: "Load and store",
    source: "MOV X1, #0x1000\nMOV X2, #42\nSTR X2, [X1, #8]\nLDR X3, [X1, #8]\nADD X4, X3, #1",
    blurb: "Stores 42 at 0x1008, loads it back and adds 1. Watch the data cache miss, then hit.",
  },
  {
    id: "logic",
    name: "Bitwise logic",
    source: "MOV X0, #0xF0\nMOV X1, #0x3C\nAND X2, X0, X1\nORR X3, X0, X1\nAND X4, X3, #0xF",
    blurb: "AND keeps bits set in both operands, ORR keeps bits set in either.",
  },
];
