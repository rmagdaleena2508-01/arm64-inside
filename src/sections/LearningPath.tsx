import * as React from "react";
import { Reveal, SectionHead } from "../ui";

interface Node {
  id: string;
  name: string;
  x: number;
  y: number;
  main?: boolean;
  why: string;
  arm: string;
  try: string;
}

const NODES: Node[] = [
  { id: "coa", name: "Computer architecture", x: 80, y: 120, main: true, why: "Instruction execution, registers, datapaths and the memory hierarchy are the core of a COA course. ARM64 is a clean, modern, real ISA to study them on.", arm: "Trace an instruction through fetch, decode, execute, memory and write-back, as in the processor above.", try: "Count how many steps the pipeline saves on the sample program." },
  { id: "asm", name: "Assembly language", x: 250, y: 120, main: true, why: "Assembly is the ISA written as text. Reading it shows exactly what a machine does, with nothing hidden.", arm: "A64 has a regular syntax: ADD X2, X0, X1 reads as X2 = X0 + X1. Loads and stores are the only way to touch memory.", try: "Write a program in the Learning Lab that swaps two values in memory." },
  { id: "os", name: "Operating systems", x: 420, y: 120, main: true, why: "An OS depends on the architecture for privilege levels, exceptions, interrupts and virtual memory.", arm: "AArch64 has four exception levels: EL0 for apps, EL1 for the OS kernel, EL2 for a hypervisor and EL3 for secure firmware. Apps ask the kernel for services with the SVC (supervisor call) instruction.", try: "Look up how Linux on arm64 passes system call numbers in X8." },
  { id: "cc", name: "Compilers", x: 590, y: 120, main: true, why: "Compilers translate high-level code into machine instructions and must respect the ISA and its calling convention.", arm: "The Procedure Call Standard (AAPCS64) passes the first eight arguments in X0–X7, returns results in X0 and keeps the return address in X30, the link register.", try: "Compile a small C function for arm64 in Compiler Explorer and read the output." },
  { id: "sys", name: "Systems engineering", x: 760, y: 120, main: true, why: "Building reliable, fast systems means understanding the hardware they run on: caches, cores, memory ordering and power.", arm: "ARM64's weakly ordered memory model is one reason concurrent code uses acquire and release instructions (LDAR, STLR) or barriers.", try: "Read about why a missing barrier can break a lock on a weakly ordered machine." },
  { id: "sec", name: "Cybersecurity", x: 335, y: 245, why: "Reverse engineering, binary analysis and exploit mitigation all happen at the instruction level.", arm: "ARM64 adds hardware defences such as pointer authentication (PAC), branch target identification (BTI) and the memory tagging extension (MTE). Analysts read A64 disassembly in tools like Ghidra.", try: "Find a PACIASP instruction at the start of a function in an arm64 binary." },
  { id: "emb", name: "Embedded systems", x: 505, y: 245, why: "Embedded engineers work right where hardware and software meet: registers, interrupts and memory-mapped devices.", arm: "Knowing AArch64 helps on Linux-class embedded boards. Knowing Arm's M-profile helps on microcontrollers.", try: "Boot a Raspberry Pi with a 64-bit OS and check uname -m (it prints aarch64)." },
  { id: "cloud", name: "Cloud and AI engineering", x: 675, y: 245, why: "Deploying to ARM64 servers and tuning for CPUs next to GPUs needs hardware-aware software.", arm: "Multi-architecture container images, SIMD (Neon, SVE) and cache-friendly data layouts all matter on ARM64 cloud instances.", try: "Build a Docker image for linux/arm64 and linux/amd64 with docker buildx." },
];

const EDGES: [string, string][] = [
  ["coa", "asm"], ["asm", "os"], ["os", "cc"], ["cc", "sys"],
  ["asm", "sec"], ["os", "emb"], ["cc", "cloud"],
];

export function StudentLearningPath() {
  const [sel, setSel] = React.useState("coa");
  const n = NODES.find((x) => x.id === sel)!;
  const linked = new Set(EDGES.filter(([a, b]) => a === sel || b === sel).flat());
  const at = (id: string) => NODES.find((x) => x.id === id)!;
  return (
    <section id="why" className="section">
      <div className="wrap">
        <SectionHead num="06" eyebrow="Why it matters" title="Why ARM64 Matters to Computer Science Students" lede="ARM64 knowledge isn't only for chip designers. It connects to almost every systems course you'll take. Select a subject to see how." />
        <Reveal className="path card">
          <svg viewBox="0 84 840 186" className="path-svg" role="group" aria-label="Learning path">
            {EDGES.map(([a, b]) => {
              const A = at(a);
              const B = at(b);
              const on = linked.has(a) && linked.has(b) && (a === sel || b === sel);
              const d = A.y === B.y ? `M${A.x + 70} ${A.y}H${B.x - 70}` : `M${A.x} ${A.y + 22}V${(A.y + B.y) / 2}H${B.x}V${B.y - 22}`;
              return <path key={a + b} d={d} className="path-edge" data-on={on ? "" : undefined} />;
            })}
            {NODES.map((x) => (
              <g key={x.id} className="path-node" data-main={x.main ? "" : undefined} data-sel={x.id === sel ? "" : undefined} data-linked={linked.has(x.id) ? "" : undefined} transform={`translate(${x.x} ${x.y})`}>
                <foreignObject x={-70} y={-22} width={140} height={44}>
                  <button onClick={() => setSel(x.id)} aria-pressed={x.id === sel}>{x.name}</button>
                </foreignObject>
              </g>
            ))}
          </svg>
          <div className="path-list" role="group" aria-label="Subjects">
            {NODES.map((x) => (
              <button key={x.id} className="chip-btn" aria-pressed={x.id === sel} onClick={() => setSel(x.id)}>{x.name}</button>
            ))}
          </div>
          <div className="path-detail" aria-live="polite">
            <h3 className="h3">{n.name}</h3>
            <p>{n.why}</p>
            <h5>The ARM64 connection</h5>
            <p>{n.arm}</p>
            <p className="note"><strong>Try it.</strong> {n.try}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
