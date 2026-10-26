import * as React from "react";
import { Reveal, SectionHead } from "../ui";

export const NAV = [
  { id: "intro", num: "01", label: "What is ARM64" },
  { id: "engineers", num: "02", label: "Engineers" },
  { id: "history", num: "03", label: "History" },
  { id: "uses", num: "04", label: "Applications" },
  { id: "inside", num: "05", label: "Inside the processor" },
  { id: "why", num: "06", label: "Why study it" },
  { id: "lab", num: "07", label: "Lab" },
];

export function Navigation() {
  const [active, setActive] = React.useState("");
  const [progress, setProgress] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
    }, { rootMargin: "-40% 0px -55% 0px" });
    NAV.forEach((n) => {
      const el = document.getElementById(n.id);
      if (el) io.observe(el);
    });
    const onScroll = () => {
      const h = document.documentElement;
      setProgress(h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return (
    <nav className="nav" aria-label="Sections">
      <div className="nav-inner">
        <a href="#top" className="brand">
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 20 16 24 24 20 24 12 16 8 8 12Z M8 12 16 16 24 12 M16 16v8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
          <span>ARM64 <span className="muted">— Inside the Architecture</span></span>
        </a>
        <button className="nav-toggle" aria-expanded={open} aria-controls="nav-links" onClick={() => setOpen((o) => !o)}>Sections</button>
        <ol id="nav-links" className="nav-links" data-open={open ? "" : undefined}>
          {NAV.map((n) => (
            <li key={n.id}>
              <a href={`#${n.id}`} aria-current={active === n.id ? "location" : undefined} onClick={() => setOpen(false)}>
                <span className="mono">{n.num}</span> {n.label}
              </a>
            </li>
          ))}
        </ol>
      </div>
      <span className="nav-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
    </nav>
  );
}

const REFS: { group: string; items: { title: string; by: string; url?: string }[] }[] = [
  {
    group: "Architecture and instruction set",
    items: [
      { title: "Arm Architecture Reference Manual for A-profile architecture (DDI 0487)", by: "Arm", url: "https://developer.arm.com/documentation/ddi0487/latest" },
      { title: "Arm A64 Instruction Set Architecture (DDI 0602)", by: "Arm", url: "https://developer.arm.com/documentation/ddi0602/latest" },
      { title: "Learn the architecture: AArch64 Instruction Set Architecture", by: "Arm Developer", url: "https://developer.arm.com/documentation/102374/latest" },
      { title: "Learn the architecture: AArch64 Exception Model", by: "Arm Developer", url: "https://developer.arm.com/documentation/102412/latest" },
      { title: "Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64)", by: "Arm, ABI for the Arm Architecture", url: "https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst" },
      { title: "A-Profile architecture overview", by: "Arm", url: "https://www.arm.com/architecture/cpu/a-profile" },
    ],
  },
  {
    group: "History",
    items: [
      { title: "The Armv8-A architecture and its ongoing development", by: "Arm Community blog", url: "https://developer.arm.com/community/arm-community-blogs/b/architectures-and-processors-blog/posts/the-armv8-a-architecture-and-its-ongoing-development" },
      { title: "40 years of the Arm architecture", by: "Arm Newsroom", url: "https://newsroom.arm.com/blog/40-year-anniversary-of-arm-architecture" },
      { title: "ARM history", by: "WikiChip", url: "https://en.wikichip.org/wiki/arm/history" },
      { title: "Apple unleashes M1 (10 November 2020)", by: "Apple Newsroom", url: "https://www.apple.com/newsroom/2020/11/apple-unleashes-m1/" },
    ],
  },
  {
    group: "Applications",
    items: [
      { title: "AWS Graviton processors", by: "Amazon Web Services", url: "https://aws.amazon.com/ec2/graviton/" },
      { title: "NVIDIA Grace CPU", by: "NVIDIA", url: "https://www.nvidia.com/en-us/data-center/grace-cpu/" },
    ],
  },
  {
    group: "Textbook",
    items: [
      { title: "Computer Organization and Design, ARM Edition: The Hardware/Software Interface", by: "David A. Patterson and John L. Hennessy, Morgan Kaufmann (source of the teaching datapath and control-signal names)" },
    ],
  },
];

export function References() {
  return (
    <section id="refs" className="section">
      <div className="wrap">
        <SectionHead num="08" eyebrow="References" title="Sources and further reading" lede="Official Arm documentation is the primary reference for every technical claim on this page. Where the teaching model simplifies real hardware, the page says so." />
        <Reveal className="refs">
          {REFS.map((g) => (
            <div key={g.group}>
              <h5>{g.group}</h5>
              <ul>
                {g.items.map((r) => (
                  <li key={r.title}>
                    {r.url ? <a href={r.url} target="_blank" rel="noreferrer">{r.title}</a> : <span className="strong">{r.title}</span>}
                    <span className="muted small"> · {r.by}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Reveal>
        <Reveal className="simplifications card">
          <h3 className="h3">What this site simplifies</h3>
          <ul>
            <li>The processor model is an educational design, not the floor plan of any real chip. ARM64 defines an instruction set, not an implementation.</li>
            <li>The simulator runs a small subset of A64 (MOV, ADD, SUB, AND, ORR, LDR, STR) on X registers only. It has no flags, branches, W registers, SP or exceptions.</li>
            <li>The five-stage pipeline, its forwarding and its single load-use stall are a textbook model. Its steps aren't the clock cycles of any real processor.</li>
            <li>The caches (4 lines of 16 bytes, direct-mapped, write-back) are tiny on purpose. Real cache designs vary by implementation.</li>
            <li>Memory accesses must be 8-byte aligned in the simulator. Real AArch64 hardware generally allows unaligned access to normal memory.</li>
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div>
          <p>ARM64 — Inside the Architecture · a Computer Organization and Architecture project.</p>
          <p className="muted small">
            Processor and device illustrations are drawn with the open-source <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noreferrer">Anatomy</a> isometric kit (MIT licence). Arm, Cortex and Neoverse are trademarks of Arm Limited. This independent educational site isn't affiliated with Arm.
          </p>
        </div>
        <p className="credit">
          Designed and developed by{" "}
          <a href="https://github.com/rmagdaleena2508-01" target="_blank" rel="noreferrer">Magdaleena</a>
        </p>
      </div>
    </footer>
  );
}
