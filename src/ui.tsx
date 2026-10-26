import * as React from "react";

/** Fades a block in the first time it scrolls into view. */
export function Reveal({ children, className = "", as: Tag = "div", delay = 0 }: { children: React.ReactNode; className?: string; as?: React.ElementType; delay?: number }) {
  const ref = React.useRef<HTMLElement>(null);
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setShown(true);
        io.disconnect();
      }
    }, { rootMargin: "0px 0px -10% 0px" });
    io.observe(node);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${className}`} data-shown={shown ? "" : undefined} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </Tag>
  );
}

export function SectionHead({ num, eyebrow, title, lede }: { num: string; eyebrow: string; title: string; lede?: React.ReactNode }) {
  return (
    <Reveal>
      <p className="eyebrow">
        {num} · {eyebrow}
      </p>
      <h2 className="h2">{title}</h2>
      {lede ? <p className="lede">{lede}</p> : null}
    </Reveal>
  );
}

export function Outcome({ children }: { children: React.ReactNode }) {
  return (
    <Reveal className="outcome">
      <span className="eyebrow">Learning outcome</span>
      <p>{children}</p>
    </Reveal>
  );
}
