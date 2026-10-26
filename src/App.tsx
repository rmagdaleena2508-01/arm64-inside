import { ApplicationExplorer } from "./sections/Applications";
import { Footer, Navigation, References } from "./sections/Chrome";
import { EvolutionTimeline, HistoryTimeline } from "./sections/History";
import { ARM64Introduction, HeroSection } from "./sections/Intro";
import { LearningLab } from "./sections/Labs";
import { StudentLearningPath } from "./sections/LearningPath";
import { ProcessorExplorer } from "./sections/ProcessorExplorer";
import { Outcome, SectionHead } from "./ui";

export default function App() {
  return (
    <>
      <a className="skip" href="#inside">Skip to the processor explorer</a>
      <Navigation />
      <main className="grid-bg">
        <HeroSection />
        <ARM64Introduction />
        <HistoryTimeline />
        <EvolutionTimeline />
        <ApplicationExplorer />
        <section id="inside" className="section section-feature">
          <div className="wrap wrap-wide">
            <SectionHead num="05" eyebrow="Inside an ARM64 processor" title="Step Inside the Processor" lede="Discover how instructions become computation. Run real A64 machine code through a simplified teaching processor: every register value, cache line and lit wire comes from one execution model." />
            <div className="mt-10">
              <ProcessorExplorer />
            </div>
            <Outcome>You can follow one instruction from fetch to write-back, name the job of every unit it passes through, and explain why a pipeline overlaps instructions.</Outcome>
          </div>
        </section>
        <StudentLearningPath />
        <LearningLab />
        <References />
      </main>
      <Footer />
    </>
  );
}
