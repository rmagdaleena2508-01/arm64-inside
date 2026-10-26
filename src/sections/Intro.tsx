import * as React from "react";
import { ProcessorFigure } from "../figure/ProcessorFigure";
import { HEIGHT, WIDTH, buildFigure } from "../figure/geometry";
import { useInView, useStillness } from "../kit/react/live";
import { parseProgram } from "../sim/isa";
import { buildTrace } from "../sim/machine";
import { PROGRAMS } from "../sim/programs";
import { Outcome, Reveal, SectionHead } from "../ui";

const HERO_PROGRAM = parseProgram(PROGRAMS[0].source).instrs;
const HERO_TRACE = buildTrace(HERO_PROGRAM);

/** The same teaching processor as section 5, running the sample program on a loop. */
function HeroFigure() {
  const art = React.useMemo(() => buildFigure(40), []);
  const still = useStillness();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const last = HERO_TRACE.frames.length - 1;
  const [i, setI] = React.useState(last);
  React.useEffect(() => {
    if (still || !inView) return;
    const id = window.setInterval(() => setI((x) => (x >= last ? 1 : x + 1)), 1100);
    return () => window.clearInterval(id);
  }, [still, inView, last]);
  const frame = HERO_TRACE.frames[still ? last : i];
  return (
    <div ref={ref} className="iso hero-figure" aria-hidden="true">
      <ProcessorFigure art={art} frame={frame} instr={frame.instr >= 0 ? HERO_PROGRAM[frame.instr] : null} selected={null} exploded={false} view={{ zoom: 1, cx: WIDTH / 2, cy: HEIGHT / 2 }} onView={() => {}} onPick={() => {}} onHover={() => {}} />
      <p className="mono small hero-figure-cap">{frame.stage ? `${HERO_PROGRAM[frame.instr].text} · ${frame.stage}` : "MOV X0, #5 …"}</p>
    </div>
  );
}

const TERMS = [
  {
    id: "isa",
    term: "Instruction set architecture",
    short: "ISA",
    body: "An ISA is the contract between software and hardware. It lists the instructions a processor understands, the registers software can see, how memory is addressed, and what happens on exceptions. Compilers and operating systems target the ISA. Any processor that implements it can run the same machine code.",
    eg: "Think of it like a published language. Many people can speak it, each in their own voice.",
  },
  {
    id: "arm64",
    term: "ARM64",
    short: "the common name",
    body: "ARM64 is the everyday name for the 64-bit Arm architecture. Operating systems and toolchains use it, or its sibling arm64 or aarch64, to label 64-bit Arm builds. It isn't a single chip: it describes the instruction set that many different processors implement.",
    eg: "Debian, Windows and macOS say arm64. GCC, Linux kernels and LLVM targets often say aarch64.",
  },
  {
    id: "aarch64",
    term: "AArch64",
    short: "the 64-bit execution state",
    body: "AArch64 is Arm's official name for the 64-bit execution state, introduced in Armv8-A. In AArch64 the processor runs the A64 instruction set: fixed 32-bit instructions, 31 general-purpose 64-bit registers (X0 to X30) and 64-bit addresses. The older 32-bit state is AArch32, which runs the A32 and T32 (Thumb) instruction sets.",
    eg: "Some Armv8-A cores support both states. Many newer cores support AArch64 only.",
  },
  {
    id: "bits",
    term: "64-bit computing",
    short: "what the 64 means",
    body: "In a 64-bit architecture the general-purpose registers hold 64 bits and pointers are 64 bits wide. That lets one program address far more than the 4 GiB limit of 32-bit addresses, and do 64-bit integer arithmetic in one instruction. Real processors implement fewer address bits than 64 (often 48 or 52), but the registers and pointers are 64 bits.",
    eg: "The instructions are still 32 bits long. \"64-bit\" is about data and addresses, not instruction size.",
  },
  {
    id: "versions",
    term: "Armv8-A and Armv9-A",
    short: "architecture versions",
    body: "Armv8-A (announced in 2011) added the AArch64 execution state, which is where ARM64 begins. Later revisions (v8.1 to v8.9) added features such as atomics and pointer authentication. Armv9-A (announced in 2021) builds on Armv8-A and makes features such as the Scalable Vector Extension 2 (SVE2) part of the baseline. Both are A-profile: the profile for application processors that run rich operating systems.",
    eg: "ARM64 code written for Armv8-A runs on Armv9-A processors.",
  },
  {
    id: "micro",
    term: "ISA vs microarchitecture",
    short: "the contract vs the machine",
    body: "The microarchitecture is how one processor implements the ISA inside: its pipeline depth, how many instructions it issues per cycle, its caches, branch predictors and execution units. Arm's Cortex-A and Neoverse cores, Apple's M-series cores and Qualcomm's Oryon cores all implement ARM64, but their internals are very different.",
    eg: "Same instructions, same results, very different engines. The teaching processor on this page is one simple example.",
  },
];

const RISC = [
  { k: "Load and store", v: "Arithmetic works on registers only. Memory is reached through separate load (LDR) and store (STR) instructions." },
  { k: "Fixed-length encoding", v: "Every A64 instruction is exactly 32 bits, which makes fetching and decoding regular." },
  { k: "Many registers", v: "31 general-purpose registers keep working values close to the ALU and cut memory traffic." },
  { k: "Simple, regular operations", v: "Each instruction does a small, well-defined job, which suits pipelining. Simple doesn't mean every instruction takes one clock cycle: loads, divides and many others take longer." },
];

type Side = "arm" | "x86";
const COMPARE: { aspect: string; arm: string; x86: string }[] = [
  { aspect: "Design philosophy", arm: "RISC: a load/store architecture with simple, regular instructions.", x86: "CISC heritage: instructions can combine a memory access with arithmetic. Modern cores translate them into simpler internal micro-operations." },
  { aspect: "Instruction length", arm: "Fixed: every A64 instruction is 4 bytes.", x86: "Variable: 1 to 15 bytes per instruction." },
  { aspect: "General-purpose registers", arm: "31 × 64-bit (X0–X30), plus a zero register and a separate stack pointer.", x86: "16 × 64-bit (RAX–R15). Intel's APX extension adds 16 more." },
  { aspect: "Memory operands", arm: "Only loads and stores touch memory.", x86: "Many arithmetic instructions can read or write memory directly." },
  { aspect: "Memory ordering", arm: "Weakly ordered: software uses barriers or acquire/release instructions when order matters between cores.", x86: "Stronger ordering (total store order) by default." },
  { aspect: "Who builds it", arm: "Arm licenses its architecture and core designs. Many companies (Apple, Qualcomm, Amazon, NVIDIA, MediaTek and others) build ARM64 chips.", x86: "Mainly Intel and AMD, the x86-64 extension having been designed by AMD." },
  { aspect: "Typical deployment", arm: "Nearly all smartphones and tablets, embedded devices, Apple silicon Macs, Windows on Arm laptops and a growing share of cloud servers.", x86: "Most desktop and laptop PCs, most servers and recent game consoles." },
];

export function HeroSection() {
  return (
    <header id="top" className="hero">
      <div className="wrap hero-inner">
        <div>
          <p className="eyebrow">Computer organization and architecture · interactive guide</p>
          <h1 className="hero-title">
            ARM64
            <span>Inside the Architecture</span>
          </h1>
          <p className="lede">Explore the architecture powering modern computing: from a 1985 chip built by a small team at Acorn to the processors in your phone, laptop and the cloud. Then step inside a working teaching processor and watch instructions execute.</p>
          <div className="hero-cta">
            <a className="btn-primary" href="#inside">Step inside the processor</a>
            <a className="btn-ghost" href="#intro">Start the guided tour</a>
          </div>
        </div>
        <div className="hero-side">
          <HeroFigure />
        </div>
        <div className="hero-stats">
          <dl>
            <div><dt>Instruction size</dt><dd className="mono">32 bits</dd></div>
            <div><dt>General registers</dt><dd className="mono">31 × 64-bit</dd></div>
            <div><dt>Execution state</dt><dd className="mono">AArch64</dd></div>
            <div><dt>Introduced in</dt><dd className="mono">Armv8-A · 2011</dd></div>
          </dl>
        </div>
      </div>
      <a className="scroll-cue" href="#intro" aria-label="Scroll to the introduction">
        <span />
      </a>
    </header>
  );
}

export function ARM64Introduction() {
  const [term, setTerm] = React.useState(TERMS[0].id);
  const t = TERMS.find((x) => x.id === term)!;
  return (
    <section id="intro" className="section">
      <div className="wrap">
        <SectionHead num="01" eyebrow="Introduction" title="What is ARM64?" lede="Before looking inside a processor, it helps to separate the words people use. Pick a term to see what it means and how it relates to the others." />

        <Reveal className="terms">
          <div className="term-list" role="tablist" aria-label="Key terms" aria-orientation="vertical">
            {TERMS.map((x) => (
              <button key={x.id} role="tab" aria-selected={x.id === term} onClick={() => setTerm(x.id)}>
                <span>{x.term}</span>
                <span className="muted small">{x.short}</span>
              </button>
            ))}
          </div>
          <div className="term-body card" role="tabpanel">
            <h3 className="h3">{t.term}</h3>
            <p>{t.body}</p>
            <p className="note">{t.eg}</p>
            <StackDiagram focus={t.id} />
          </div>
        </Reveal>

        <Reveal className="risc">
          <div>
            <h3 className="h3">The RISC idea</h3>
            <p>Arm stands in the Reduced Instruction Set Computer (RISC) tradition that grew out of research at Berkeley and Stanford in the early 1980s. The idea: keep instructions simple and regular so the hardware can run them quickly and efficiently, and leave complex sequences to the compiler.</p>
          </div>
          <ul className="risc-grid">
            {RISC.map((r) => (
              <li key={r.k} className="card">
                <span className="mono small accent">{r.k}</span>
                <p>{r.v}</p>
              </li>
            ))}
          </ul>
        </Reveal>

        <ArchitectureComparison />

        <Outcome>You can explain what ARM64 and AArch64 mean, what an ISA is, and why one ISA can have many different processor designs behind it.</Outcome>
      </div>
    </section>
  );
}

/** Layers from software down to silicon, with the chosen term lit. */
function StackDiagram({ focus }: { focus: string }) {
  const layers = [
    { id: "sw", label: "Applications and operating system", sub: "compiled to machine code", lit: ["arm64", "bits"] },
    { id: "isa", label: "ISA: Arm A-profile architecture", sub: "Armv8-A, Armv9-A", lit: ["isa", "versions", "arm64"] },
    { id: "state", label: "Execution state: AArch64", sub: "A64 instructions · X0–X30 · 64-bit addresses", lit: ["aarch64", "bits", "arm64"] },
    { id: "micro", label: "Microarchitecture", sub: "Cortex-A, Neoverse, Apple, Oryon… each different", lit: ["micro"] },
    { id: "si", label: "Silicon", sub: "a physical chip", lit: ["micro"] },
  ];
  return (
    <ol className="stack" aria-label="From software to silicon">
      {layers.map((l) => (
        <li key={l.id} data-lit={l.lit.includes(focus) ? "" : undefined}>
          <span>{l.label}</span>
          <span className="mono small muted">{l.sub}</span>
        </li>
      ))}
    </ol>
  );
}

export function ArchitectureComparison() {
  const [lead, setLead] = React.useState<Side>("arm");
  const [row, setRow] = React.useState(0);
  return (
    <Reveal className="compare">
      <div className="compare-head">
        <div>
          <h3 className="h3">ARM64 and x86-64, side by side</h3>
          <p className="muted">Two different instruction set philosophies. Neither is faster or more efficient in general: performance and power depend on the specific processor design, its manufacturing process and the workload.</p>
        </div>
        <div className="seg" role="group" aria-label="Highlight">
          <button className="chip-btn" aria-pressed={lead === "arm"} onClick={() => setLead("arm")}>Highlight ARM64</button>
          <button className="chip-btn" aria-pressed={lead === "x86"} onClick={() => setLead("x86")}>Highlight x86-64</button>
        </div>
      </div>
      <div className="compare-grid" data-lead={lead}>
        <div className="compare-col-head" />
        <div className="compare-col-head mono" data-side="arm">ARM64 (AArch64)</div>
        <div className="compare-col-head mono" data-side="x86">x86-64</div>
        {COMPARE.map((c, i) => (
          <React.Fragment key={c.aspect}>
            <button className="compare-aspect" aria-expanded={row === i} onClick={() => setRow(i)}>{c.aspect}</button>
            <div className="compare-cell" data-side="arm" data-open={row === i ? "" : undefined}>{c.arm}</div>
            <div className="compare-cell" data-side="x86" data-open={row === i ? "" : undefined}>{c.x86}</div>
          </React.Fragment>
        ))}
      </div>
      <div className="encode-demo">
        <div>
          <span className="mono small muted">ARM64: add two registers</span>
          <code className="mono">ADD X2, X0, X1</code>
          <span className="mono small">word 0x8B010002 <em>· always 4 bytes</em></span>
        </div>
        <div>
          <span className="mono small muted">x86-64: add two registers</span>
          <code className="mono">add rdx, rax</code>
          <span className="mono small">bytes 48 01 C2 <em>· 3 here, up to 15</em></span>
        </div>
      </div>
    </Reveal>
  );
}
