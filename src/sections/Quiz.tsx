import * as React from "react";
import { Reveal } from "../ui";

interface Q {
  topic: string;
  q: string;
  options: string[];
  answer: number;
  why: string;
}

const QUESTIONS: Q[] = [
  { topic: "Fundamentals", q: "What is AArch64?", options: ["A specific processor made by Arm", "The 64-bit execution state of the Arm architecture, introduced in Armv8-A", "A 64-bit version of the Thumb instruction set", "Apple's name for its M-series chips"], answer: 1, why: "AArch64 is the 64-bit execution state. It runs the A64 instruction set. ARM64 is the common name for it." },
  { topic: "Fundamentals", q: "Which statement about an ISA and a microarchitecture is correct?", options: ["They mean the same thing", "Every ARM64 processor has the same internal design", "Many different microarchitectures can implement the same ISA", "The ISA defines the cache size"], answer: 2, why: "The ISA is the contract. Apple, Arm, Qualcomm and others build very different cores that all run ARM64 code." },
  { topic: "Fundamentals", q: "How long is every A64 instruction?", options: ["8 bits", "16 bits", "32 bits", "Between 1 and 15 bytes"], answer: 2, why: "Every A64 instruction is exactly 32 bits (4 bytes). Variable 1–15 byte instructions are an x86-64 trait." },
  { topic: "Fundamentals", q: "Which is a true statement about RISC?", options: ["Every RISC instruction finishes in exactly one clock cycle", "Arithmetic works on registers, and memory is reached with separate load and store instructions", "RISC processors can't do multiplication", "RISC means the processor has fewer than 32 instructions"], answer: 1, why: "RISC designs such as ARM64 are load/store architectures. Simple doesn't mean single-cycle: loads, divides and others take longer." },
  { topic: "History", q: "Who designed the original ARM instruction set and hardware at Acorn?", options: ["Robin Saxby and Hermann Hauser", "Sophie Wilson and Steve Furber", "John Hennessy and David Patterson", "Richard Grisenthwaite alone"], answer: 1, why: "Sophie Wilson designed the instruction set and Steve Furber the hardware. ARM1 first ran in April 1985." },
  { topic: "History", q: "Which companies formed Advanced RISC Machines Ltd in 1990?", options: ["Acorn, Apple and VLSI Technology", "Intel, AMD and IBM", "Nokia, Samsung and Sony", "Acorn and Microsoft"], answer: 0, why: "Acorn, Apple and VLSI Technology formed the joint venture in November 1990." },
  { topic: "History", q: "Which architecture version introduced 64-bit AArch64?", options: ["ARMv5", "ARMv7-A", "Armv8-A", "Armv9-A"], answer: 2, why: "Armv8-A, announced in 2011, introduced AArch64. Armv9-A (2021) builds on it." },
  { topic: "Registers", q: "How many 64-bit general-purpose registers does AArch64 provide?", options: ["8", "16", "31 (X0–X30)", "64"], answer: 2, why: "There are 31 general registers, X0–X30. Register number 31 means either the zero register (XZR) or the stack pointer, depending on the instruction." },
  { topic: "Registers", q: "After MOV X0, #5 · MOV X1, #10 · ADD X2, X0, X1 · SUB X3, X2, #3, what is X3?", options: ["2", "12", "15", "18"], answer: 1, why: "X2 = 5 + 10 = 15, then X3 = 15 − 3 = 12. You can watch it happen in the processor explorer." },
  { topic: "Instruction execution", q: "In the five-stage teaching pipeline, when is the destination register written?", options: ["Fetch", "Decode", "Execute", "Write back"], answer: 3, why: "The result is written to the register file in the write-back stage. Forwarding lets a following instruction use it earlier." },
  { topic: "ALU", q: "What does the ALU compute for LDR X3, [X1, #8]?", options: ["Nothing, the ALU isn't used", "The address X1 + 8", "X3 + 8", "The value stored at X1"], answer: 1, why: "For loads and stores the ALU adds the base register and offset to form the memory address." },
  { topic: "Memory", q: "Which statement about caches is correct?", options: ["The ARM64 ISA fixes the cache size at 32 KB", "Cache size and policy depend on the processor implementation", "ARM64 processors have no caches", "Caches make memory slower"], answer: 1, why: "The architecture defines the memory model. Cache sizes, levels and policies are implementation choices." },
  { topic: "Memory", q: "A store hits a write-back cache. What happens to main memory right away?", options: ["It's updated immediately", "Nothing yet: the cache line is marked dirty and written back when it's evicted", "The store is cancelled", "The whole cache is cleared"], answer: 1, why: "In a write-back cache the line becomes dirty, and memory is updated later when the line is evicted. Lab 2 shows this." },
  { topic: "Applications", q: "In an AI server with an ARM64 CPU and GPUs, what does the ARM64 CPU typically do?", options: ["All of the matrix maths for training", "Coordinates the work: prepares data and launches work on the GPUs", "Nothing, it's switched off", "Only displays graphics"], answer: 1, why: "Heavy AI maths usually runs on GPUs or NPUs. The CPU orchestrates, though it can run smaller inference work itself." },
  { topic: "Applications", q: "Which device is most likely to use a 32-bit Cortex-M microcontroller rather than an ARM64 application processor?", options: ["A cloud server", "An Apple silicon laptop", "A small battery-powered temperature sensor", "A flagship smartphone"], answer: 2, why: "Small sensors run tiny firmware on Cortex-M microcontrollers, which use Arm's M-profile, not ARM64." },
];

export function KnowledgeQuiz() {
  const [i, setI] = React.useState(0);
  const [picked, setPicked] = React.useState<number | null>(null);
  const [answers, setAnswers] = React.useState<boolean[]>([]);
  const done = i >= QUESTIONS.length;
  const q = QUESTIONS[Math.min(i, QUESTIONS.length - 1)];
  const score = answers.filter(Boolean).length;
  const restart = () => {
    setI(0);
    setPicked(null);
    setAnswers([]);
  };
  const choose = (n: number) => {
    if (picked !== null) return;
    setPicked(n);
    setAnswers((a) => [...a, n === q.answer]);
  };
  const next = () => {
    setPicked(null);
    setI((x) => x + 1);
  };
  const byTopic = QUESTIONS.reduce<Record<string, [number, number]>>((acc, qq, n) => {
    const t = acc[qq.topic] ?? [0, 0];
    acc[qq.topic] = [t[0] + (answers[n] ? 1 : 0), t[1] + 1];
    return acc;
  }, {});
  return (
    <Reveal className="lab card quiz">
      <header className="lab-head">
        <span className="eyebrow">Lab 3</span>
        <h3 className="h3">Knowledge check</h3>
        <p className="muted small">{QUESTIONS.length} questions on ARM64 fundamentals, history, registers, execution, the ALU, memory and applications.</p>
      </header>
      {done ? (
        <div className="quiz-result" aria-live="polite">
          <p className="quiz-score mono">{score} / {QUESTIONS.length}</p>
          <p>{score === QUESTIONS.length ? "Perfect score." : score >= QUESTIONS.length * 0.7 ? "Strong result. Review the topics below with a miss." : "Worth another pass. The explorer and labs above cover every question."}</p>
          <ul className="quiz-topics">
            {Object.entries(byTopic).map(([t, [ok, n]]) => (
              <li key={t}><span>{t}</span><span className="mono">{ok}/{n}</span></li>
            ))}
          </ul>
          <button className="chip-btn primary-chip" onClick={restart}>Try again</button>
        </div>
      ) : (
        <div>
          <div className="quiz-meta">
            <span className="mono small muted">Question {i + 1} of {QUESTIONS.length} · {q.topic}</span>
            <span className="mono small muted">Score {score}</span>
          </div>
          <div className="progress"><span style={{ width: `${(answers.length / QUESTIONS.length) * 100}%` }} /></div>
          <p className="quiz-q">{q.q}</p>
          <ul className="quiz-options" role="list">
            {q.options.map((o, n) => {
              const state = picked === null ? undefined : n === q.answer ? "right" : n === picked ? "wrong" : undefined;
              return (
                <li key={o}>
                  <button onClick={() => choose(n)} data-state={state} disabled={picked !== null && state === undefined} aria-pressed={picked === n}>
                    <span className="mono">{String.fromCharCode(65 + n)}</span> {o}
                  </button>
                </li>
              );
            })}
          </ul>
          {picked !== null ? (
            <div className="quiz-feedback" aria-live="polite" data-right={picked === q.answer ? "" : undefined}>
              <p><strong>{picked === q.answer ? "Correct." : "Not quite."}</strong> {q.why}</p>
              <button className="chip-btn primary-chip" onClick={next}>{i === QUESTIONS.length - 1 ? "See your score" : "Next question"}</button>
            </div>
          ) : null}
        </div>
      )}
    </Reveal>
  );
}
