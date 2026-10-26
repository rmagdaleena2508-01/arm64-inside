import type { Part } from "../sim/machine";

export interface PartInfo {
  id: Part;
  num: string;
  name: string;
  short: string;
  object: string; // what the physical model shows
  purpose: string;
  inputs: string[];
  outputs: string[];
  role: string; // role in executing an instruction
  stage: string;
  real: string; // how real implementations differ
}

export const PARTS: PartInfo[] = [
  {
    id: "icache",
    num: "01",
    name: "Instruction cache",
    short: "Keeps recently used instructions close to the core.",
    object: "A four-drawer cabinet. Each drawer is one cache line holding four 32-bit instructions. The left pin on top shows the line is valid.",
    purpose: "Main memory is far slower than the core. The instruction cache keeps copies of recently fetched instruction bytes so most fetches don't have to wait for memory.",
    inputs: ["Instruction address from the fetch unit (the PC)", "Refill data from the memory interface on a miss"],
    outputs: ["The 32-bit instruction word at that address"],
    role: "In the fetch stage the PC is looked up here. On a hit the word comes straight back. On a miss the whole line is loaded from memory first.",
    stage: "IF",
    real: "Cache size, associativity and line length are design choices. They aren't part of the ISA. This model uses 4 direct-mapped lines of 16 bytes.",
  },
  {
    id: "fetch",
    num: "02",
    name: "Instruction fetch unit",
    short: "Holds the program counter and fetches the next instruction.",
    object: "A dial gauge whose needle is the program counter. It steps one tick per instruction, because every A64 instruction is exactly 4 bytes. The knurled knob is the +4 adder.",
    purpose: "The fetch unit decides which instruction runs next. It sends the PC to the instruction cache and works out the next PC.",
    inputs: ["The current PC", "The instruction word from the instruction cache"],
    outputs: ["The instruction word, passed to the decoder", "The next PC (PC + 4 for straight-line code)"],
    role: "Every instruction starts here. Branches would change the next PC, but this subset has no branches, so the PC always moves on by 4.",
    stage: "IF",
    real: "Real cores fetch several instructions per cycle and predict branches long before they execute. In AArch64 the PC isn't a general-purpose register.",
  },
  {
    id: "decoder",
    num: "03",
    name: "Instruction decoder",
    short: "Splits the 32-bit word into its fields.",
    object: "A bed of 32 pins, one per bit. A raised pin is a 1. The lines across the bed mark the field boundaries for the current encoding: opcode, registers and immediate.",
    purpose: "The decoder works out what the instruction is (its opcode and form) and which registers and immediate value it uses.",
    inputs: ["The 32-bit instruction word"],
    outputs: ["Register numbers (Rd, Rn, Rm or Rt) to the register file", "The immediate value to the ALU", "The opcode to the control unit"],
    role: "In the decode stage, fields such as Rn (bits 9–5) and Rd (bits 4–0) go straight to the register file while the opcode bits go to control.",
    stage: "ID",
    real: "Fixed-length 32-bit A64 encodings make decoding regular. Many cores also split instructions into internal micro-operations, which the ISA doesn't define.",
  },
  {
    id: "control",
    num: "04",
    name: "Control unit",
    short: "Turns the opcode into control signals.",
    object: "Six sliding switches, one per control signal: Reg2Loc, ALUSrc, MemToReg, RegWrite, MemRead and MemWrite. A switch slid forward and lit is on.",
    purpose: "Control decides how the datapath behaves for this instruction: where the ALU's second operand comes from, whether memory is read or written, and whether a register is written.",
    inputs: ["Opcode bits from the decoder"],
    outputs: ["Control signals to the register file, ALU, data cache and write-back mux"],
    role: "Signals are set in decode and travel with the instruction. For LDR: ALUSrc = immediate, MemRead = 1, MemToReg = 1, RegWrite = 1.",
    stage: "ID",
    real: "These signal names come from the teaching datapath in Patterson and Hennessy's ARM edition. Real cores generate far more internal controls.",
  },
  {
    id: "regfile",
    num: "05",
    name: "Register file",
    short: "31 general-purpose 64-bit registers, X0 to X30.",
    object: "A cabinet of 32 drawers in four columns of eight, X0 at bottom left. The last drawer is fixed shut: register number 31 reads as zero (XZR) in these instructions. A drawer slides out when it's read or written.",
    purpose: "Registers are the fastest storage in the processor. Almost every A64 instruction reads its operands from registers and writes its result to one.",
    inputs: ["Read register numbers from the decoder", "Write register number, value and RegWrite from write-back"],
    outputs: ["Two read values to the ALU (and store data to the data cache)"],
    role: "Read in decode, written in write-back. The register file has two read ports and one write port.",
    stage: "ID / WB",
    real: "AArch64 defines 31 X registers. Writing a 32-bit W register zero-extends into the full X register. Real cores rename registers onto a much larger physical file.",
  },
  {
    id: "alu",
    num: "06",
    name: "Arithmetic logic unit",
    short: "Does the arithmetic and logic.",
    object: "A chevron-shaped block: two operand inputs on the notched side, one result out of the point.",
    purpose: "The ALU adds, subtracts and does bitwise logic. For loads and stores it also adds the base register and offset to form the memory address.",
    inputs: ["Operand A from the register file", "Operand B from a register or the immediate (chosen by ALUSrc)", "The operation from control"],
    outputs: ["The result, to write-back or to the data cache as an address"],
    role: "In the execute stage. ADD X2, X0, X1 computes 5 + 10 = 15 here.",
    stage: "EX",
    real: "Cores have several ALUs plus separate units for multiply, divide, floating point and SIMD (Neon, SVE). Integer arithmetic wraps modulo 2⁶⁴.",
  },
  {
    id: "dcache",
    num: "07",
    name: "Data cache",
    short: "Keeps recently used data close to the core.",
    object: "A second four-drawer cabinet for data. On top, the left pin of each line shows it's valid and the right pin lights up when the line is dirty (changed but not yet written to memory).",
    purpose: "Loads and stores go to the data cache first. It holds copies of memory lines so most accesses don't wait for main memory.",
    inputs: ["The address from the ALU", "Store data from the register file", "MemRead and MemWrite from control"],
    outputs: ["Loaded data to write-back", "Line fills and write-backs to and from the memory interface"],
    role: "In the memory stage. On a miss the line is filled from memory. A store marks its line dirty, and the line is written back later when it's evicted.",
    stage: "MEM",
    real: "Write-back with write-allocate is common, but policies, sizes and coherence protocols vary by implementation. The architecture defines the memory model, not the cache design.",
  },
  {
    id: "memif",
    num: "08",
    name: "Main memory interface",
    short: "Connects the caches to main memory.",
    object: "A memory controller with heat-sink fins, a socket and a memory module standing in it.",
    purpose: "When a cache misses, the memory interface reads or writes whole lines of main memory.",
    inputs: ["Miss requests and dirty lines from both caches"],
    outputs: ["Cache line fills"],
    role: "Only used on a cache miss or a write-back, which is why caches matter: memory is many times slower than the core.",
    stage: "IF / MEM on a miss",
    real: "Real systems put more levels of cache (L2, L3, system cache), interconnects and DRAM controllers between the core and memory.",
  },
  {
    id: "datapath",
    num: "09",
    name: "Datapath",
    short: "The connections that carry values between units.",
    object: "Copper traces on the board. Where two traces cross, one dives under through a pair of vias. The small block near the data cache is the write-back mux, which picks the ALU result or the loaded data.",
    purpose: "The datapath is the set of buses, multiplexers and pipeline registers that move instruction words, operands, addresses and results between the units.",
    inputs: ["Values from every unit"],
    outputs: ["Values to every unit"],
    role: "Each stage lights the traces it uses. Watch ADD: operands go from registers to the ALU, then the result travels through the mux back to the register file.",
    stage: "All",
    real: "Pipelined cores add pipeline registers between stages and forwarding paths that send results straight back to the ALU without waiting for write-back.",
  },
];

export const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p])) as Record<Part, PartInfo>;
