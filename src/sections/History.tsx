import * as React from "react";
import { Mini, type MiniKind } from "../figure/minis";
import { Reveal, SectionHead } from "../ui";

interface Milestone {
  year: string;
  title: string;
  what: string;
  why: string;
  art: MiniKind;
}

const PEOPLE: Milestone[] = [
  {
    year: "1983",
    title: "Acorn starts its own processor",
    what: "Acorn Computers in Cambridge, maker of the BBC Micro, couldn't find a processor it liked for its next machine. Inspired by the Berkeley RISC papers, Sophie Wilson designed the instruction set and Steve Furber led the hardware design of the Acorn RISC Machine.",
    why: "A small team chose simplicity on purpose: a design small enough for a handful of engineers to build.",
    art: "board",
  },
  {
    year: "1985",
    title: "ARM1: first silicon",
    what: "The first ARM1 chips arrived from VLSI Technology on 26 April 1985 and worked first time. The chip had about 25,000 transistors on a 3 µm process. Wilson had first modelled the whole instruction set in BBC BASIC.",
    why: "A 32-bit RISC processor this small and this low-power became the seed of everything that followed.",
    art: "chip",
  },
  {
    year: "1987",
    title: "ARM2 in the Acorn Archimedes",
    what: "ARM2 added a multiply instruction and shipped in the Acorn Archimedes, one of the first RISC-based home computers.",
    why: "It proved the design in a real product people bought.",
    art: "board",
  },
  {
    year: "1990",
    title: "Advanced RISC Machines Ltd",
    what: "In November 1990 Acorn, Apple and VLSI Technology formed a joint venture, Advanced RISC Machines Ltd, with twelve engineers from Acorn's ARM team. Robin Saxby joined as chief executive in 1991.",
    why: "Apple wanted a low-power processor for the Newton handheld. The new company was set up to serve many customers, not only Acorn.",
    art: "venture",
  },
  {
    year: "1990s",
    title: "Selling designs, not chips",
    what: "Arm chose not to manufacture chips. It licenses its architecture and processor designs (its IP) to semiconductor companies, which build their own chips. Some license ready-made cores. Others take an architecture licence and design their own compatible cores.",
    why: "This licensing model is why so many companies make ARM-based chips, and why ARM64 processors differ so much inside.",
    art: "licence",
  },
  {
    year: "2011",
    title: "Armv8-A brings 64-bit",
    what: "In October 2011 Arm previewed Armv8-A, with the new AArch64 execution state and the A64 instruction set. It was developed by Arm's architecture team; Arm's chief architect, Richard Grisenthwaite, presented it. Arm's first Armv8-A cores, Cortex-A53 and Cortex-A57, followed in 2012.",
    why: "ARM64 is a new design rather than a stretched ARM32: new encodings, 31 general registers and a cleaner exception model, made by a different generation of engineers from the original ARM1 team.",
    art: "chip64",
  },
];

const ERAS: { year: string; title: string; text: string; caps: string[]; domains: string[]; bits: 32 | 64; art: MiniKind }[] = [
  { year: "1985", title: "Early ARM development", text: "ARM1 and ARM2 are built for Acorn's desktop computers: 32-bit registers, 26-bit addresses and a tiny transistor budget.", caps: ["32-bit RISC", "26-bit addresses"], domains: ["Desktop computers"], bits: 32, art: "chip" },
  { year: "1990", title: "Advanced RISC Machines is formed", text: "The ARM team becomes a separate company with Acorn, Apple and VLSI Technology as founders. ARM6-based chips go into Apple's Newton.", caps: ["32-bit addresses", "Licensable cores"], domains: ["Desktop computers", "Handhelds"], bits: 32, art: "venture" },
  { year: "1990s", title: "Embedded and mobile", text: "Thumb, a compact 16-bit instruction encoding, makes code smaller for devices with little memory. ARM7TDMI becomes one of the most widely licensed cores, used in mobile phones and many embedded products.", caps: ["Thumb instructions", "Low-power cores"], domains: ["Handhelds", "Mobile phones", "Embedded"], bits: 32, art: "sensor" },
  { year: "2000s", title: "The mobile decade", text: "ARM cores sit at the heart of nearly every mobile phone. The Cortex-A family (from 2005) brings application processors fast enough for smartphones and their rich operating systems.", caps: ["Cortex-A, -R, -M profiles", "SIMD (Neon)"], domains: ["Mobile phones", "Smartphones", "Embedded"], bits: 32, art: "phone" },
  { year: "2011", title: "Armv8-A announced", text: "Armv8-A introduces the 64-bit AArch64 execution state and the A64 instruction set, while keeping 32-bit AArch32 for existing software.", caps: ["AArch64", "A64 instructions", "31 × 64-bit registers"], domains: ["Smartphones", "Embedded"], bits: 64, art: "chip64" },
  { year: "2013", title: "64-bit reaches phones", text: "Apple's A7 in the iPhone 5s (September 2013) is the first 64-bit ARM processor in a smartphone. Android devices with Armv8-A cores follow from 2014.", caps: ["64-bit mobile OSes"], domains: ["Smartphones", "Tablets"], bits: 64, art: "phone" },
  { year: "2020", title: "Apple silicon Macs", text: "Apple begins moving the Mac from Intel x86 processors to its own ARM64 chips, starting with the M1 in November 2020. Rosetta 2 translates x86-64 apps so they keep running.", caps: ["Desktop-class ARM64 cores", "Unified memory SoC"], domains: ["Smartphones", "Laptops", "Desktops"], bits: 64, art: "laptop" },
  { year: "2021", title: "Armv9-A", text: "Arm announces Armv9-A in March 2021. It builds on Armv8-A with SVE2 vectors as standard and adds security features such as the Realm Management Extension for confidential computing.", caps: ["SVE2", "Confidential computing"], domains: ["Smartphones", "Laptops", "Servers"], bits: 64, art: "chip64" },
  { year: "2020s", title: "Cloud, AI and beyond", text: "ARM64 servers spread through the cloud: AWS Graviton (from 2018), Ampere, Microsoft Azure Cobalt and Google Axion. NVIDIA's Grace CPU pairs ARM64 cores with GPUs in AI systems, and Windows on Arm laptops grow.", caps: ["Neoverse server cores", "Many-core chips"], domains: ["Smartphones", "Laptops", "Servers", "Cloud", "AI systems", "Cars"], bits: 64, art: "cloud" },
];

const ALL_DOMAINS = ["Desktop computers", "Handhelds", "Mobile phones", "Embedded", "Smartphones", "Tablets", "Laptops", "Desktops", "Servers", "Cloud", "AI systems", "Cars"];

export function HistoryTimeline() {
  const [i, setI] = React.useState(0);
  const m = PEOPLE[i];
  const onKey = (ev: React.KeyboardEvent) => {
    if (ev.key === "ArrowRight") setI((x) => Math.min(PEOPLE.length - 1, x + 1));
    if (ev.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
  };
  return (
    <section id="engineers" className="section">
      <div className="wrap">
        <SectionHead num="02" eyebrow="Who created ARM64?" title="The Engineers Behind the Architecture" lede="ARM began as a small processor project inside a British home-computer company. ARM64 came almost three decades later, from a much larger company built around licensing that design." />
        <Reveal className="ptl">
          <ol className="ptl-rail" role="tablist" aria-label="Milestones" onKeyDown={onKey}>
            {PEOPLE.map((p, n) => (
              <li key={p.year + p.title}>
                <button role="tab" aria-selected={n === i} tabIndex={n === i ? 0 : -1} onClick={() => setI(n)}>
                  <span className="mono">{p.year}</span>
                  <span className="small">{p.title}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="ptl-body card" role="tabpanel" key={i}>
            <div className="ptl-art">
              <Mini kind={m.art} label={`Illustration: ${m.title}`} />
            </div>
            <div>
              <p className="mono ptl-year">{m.year}</p>
              <h3 className="h3">{m.title}</h3>
              <p>{m.what}</p>
              <h5>Why it mattered</h5>
              <p>{m.why}</p>
              <div className="ptl-nav">
                <button className="chip-btn" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>← Earlier</button>
                <button className="chip-btn" onClick={() => setI((x) => Math.min(PEOPLE.length - 1, x + 1))} disabled={i === PEOPLE.length - 1}>Later →</button>
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal className="two-teams">
          <div className="card">
            <span className="eyebrow">Original ARM, 1983–85</span>
            <p>Sophie Wilson (instruction set) and Steve Furber (hardware design) at Acorn Computers, with a small team. Their design was 32-bit.</p>
          </div>
          <div className="card">
            <span className="eyebrow violet">ARM64, 2011</span>
            <p>Arm's architecture team, decades later, designed the AArch64 state and A64 instruction set in Armv8-A. Many companies then built their own processors that implement it.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function EvolutionTimeline() {
  const [active, setActive] = React.useState(0);
  const refs = React.useRef<(HTMLLIElement | null)[]>([]);
  React.useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      const seen = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.i));
      if (seen.length) setActive(Math.max(...seen));
    }, { rootMargin: "-45% 0px -45% 0px" });
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);
  const era = ERAS[active];
  return (
    <section id="history" className="section">
      <div className="wrap">
        <SectionHead num="03" eyebrow="History and evolution" title="From Acorn to Modern Computing" lede="Scroll through the milestones. The panel shows what the architecture could do at each point and where it was used. Each generation was built by different companies with different internal designs." />
        <div className="evo">
          <div className="evo-sticky">
            <div className="card evo-panel" aria-live="polite">
              <div className="evo-top">
                <span className="mono evo-year">{era.year}</span>
                <span className="mono small bits" data-bits={era.bits}>{era.bits}-bit</span>
              </div>
              <Mini kind={era.art} label={`Illustration for ${era.year}`} />
              <h5>Capabilities</h5>
              <ul className="tags">
                {era.caps.map((c) => <li key={c}>{c}</li>)}
              </ul>
              <h5>Where it was used</h5>
              <ul className="tags domains">
                {ALL_DOMAINS.map((d) => <li key={d} data-on={era.domains.includes(d) ? "" : undefined}>{d}</li>)}
              </ul>
            </div>
          </div>
          <ol className="evo-list">
            {ERAS.map((e, n) => (
              <li key={e.year + e.title} data-i={n} ref={(el) => { refs.current[n] = el; }} data-on={n === active ? "" : undefined}>
                <button className="evo-item" onClick={() => setActive(n)}>
                  <span className="mono evo-dot">{e.year}</span>
                  <span>
                    <span className="h3 block">{e.title}</span>
                    <span className="block">{e.text}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
