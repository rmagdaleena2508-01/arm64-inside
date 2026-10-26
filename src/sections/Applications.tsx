import * as React from "react";
import { Mini, type MiniKind } from "../figure/minis";
import { Reveal, SectionHead } from "../ui";

interface App {
  id: string;
  name: string;
  art: MiniKind;
  where: string;
  does: string[];
  why: string;
  example: string;
  careful?: string;
}

const APPS: App[] = [
  {
    id: "phone",
    name: "Smartphones",
    art: "phone",
    where: "In the system-on-chip (SoC) at the heart of the phone. The ARM64 CPU cores share one die with the GPU, image processor, neural processor (NPU), modem and memory controller.",
    does: ["Runs the operating system (Android or iOS) and every app, compiled to ARM64 machine code", "Schedules work onto the GPU, NPU and other accelerators", "Mixes large fast cores with small efficient cores and moves tasks between them to save energy"],
    why: "Arm-based designs have long targeted low power, and the licensing model lets phone makers build SoCs tailored to their own needs.",
    example: "Apple A-series, Qualcomm Snapdragon, Samsung Exynos, MediaTek Dimensity and Google Tensor chips all use ARM64 CPU cores.",
  },
  {
    id: "laptop",
    name: "Laptops and PCs",
    art: "laptop",
    where: "As the main CPU in laptops and desktops, usually inside an SoC that also holds the GPU and memory.",
    does: ["Runs desktop operating systems and native ARM64 apps", "Runs older x86-64 apps through translation layers such as Apple's Rosetta 2 or Microsoft's Prism", "Balances high performance against battery life"],
    why: "Modern ARM64 designs deliver strong performance per watt, which means long battery life. Software compatibility is the main trade-off: native ARM64 builds run best, and some software is x86-only.",
    example: "Apple silicon Macs (M-series, since 2020) and Windows on Arm laptops such as Copilot+ PCs with Qualcomm Snapdragon X chips.",
  },
  {
    id: "cloud",
    name: "Cloud computing",
    art: "cloud",
    where: "In data-centre servers: chips with dozens to more than a hundred ARM64 cores, rented out as cloud instances.",
    does: ["Hosts virtual machines and containers for web servers, databases, microservices and batch jobs", "Runs multi-architecture container images built for linux/arm64", "Uses the virtualization support built into AArch64 (EL2, the hypervisor level)"],
    why: "Cloud providers choose ARM64 servers for cost and energy efficiency on scale-out workloads, and can design chips for their own data centres.",
    example: "AWS Graviton (since 2018), Microsoft Azure Cobalt, Google Axion and Ampere Altra servers, many built on Arm Neoverse cores.",
  },
  {
    id: "ai",
    name: "Artificial intelligence",
    art: "ai",
    where: "Next to the accelerators. In AI servers an ARM64 CPU feeds and coordinates GPUs; in phones and edge devices it works alongside an NPU.",
    does: ["Orchestrates work: loads models, prepares data and launches work on GPUs and NPUs", "Runs smaller inference workloads itself, using SIMD and matrix extensions (Neon, SVE, SME)", "Handles pre- and post-processing and the rest of the application"],
    why: "ARM64 CPUs can sit very close to accelerators, sharing fast links and memory, with good energy efficiency for the control work.",
    example: "NVIDIA Grace (ARM64, Neoverse V2) is paired with GPUs in Grace Hopper and Grace Blackwell systems. Jetson modules run edge AI on Cortex-A cores plus a GPU.",
    careful: "Most heavy AI training and much inference runs on GPUs or NPUs. The ARM64 CPU doesn't do all of the AI computation itself.",
  },
  {
    id: "car",
    name: "Automotive systems",
    art: "car",
    where: "In infotainment units, digital cockpits and driver-assistance computers. Smaller Arm processors run the control units around the car.",
    does: ["Runs infotainment and dashboard software on ARM64 application cores", "Processes camera and sensor data for driver assistance, together with accelerators", "Connects the car to networks and over-the-air updates"],
    why: "Automotive versions of Arm cores add safety features, and the same ARM64 software tools work from phones to cars.",
    example: "NVIDIA DRIVE Orin and many cockpit SoCs use Cortex-A78AE ARM64 cores.",
    careful: "Many safety-critical control units (brakes, engine, airbags) use Cortex-R or Cortex-M processors from Arm's real-time and microcontroller profiles. Those are mostly 32-bit and aren't ARM64 application processors.",
  },
  {
    id: "iot",
    name: "Embedded and IoT",
    art: "sensor",
    where: "In more capable embedded devices that run a full operating system such as Linux: single-board computers, smart cameras, network equipment and industrial gateways.",
    does: ["Runs Linux and full network stacks", "Processes video and sensor data locally (edge computing)", "Runs containers and over-the-air updates on devices in the field"],
    why: "When a device needs a real operating system, more memory and more performance, an ARM64 application processor fits better than a microcontroller.",
    example: "Raspberry Pi 4 and 5 (Cortex-A72 and Cortex-A76, both AArch64) and NXP i.MX 8 processors.",
    careful: "Most small sensors and gadgets use 32-bit Cortex-M microcontrollers (Armv6-M to Armv8-M). They're Arm, but not ARM64: they run small firmware, not a full OS.",
  },
];

export function ApplicationExplorer() {
  const [id, setId] = React.useState(APPS[0].id);
  const a = APPS.find((x) => x.id === id)!;
  return (
    <section id="uses" className="section">
      <div className="wrap">
        <SectionHead num="04" eyebrow="Where is ARM64 used?" title="One Architecture. Many Applications." lede="The same instruction set runs in devices that draw a few watts and in servers that draw hundreds. Pick a device to see where the processor sits and what it does." />
        <Reveal className="eco">
          <div className="eco-grid" role="tablist" aria-label="Devices">
            {APPS.map((x) => (
              <button key={x.id} role="tab" aria-selected={x.id === id} className="eco-tile" onClick={() => setId(x.id)}>
                <Mini kind={x.art} label={x.name} />
                <span>{x.name}</span>
              </button>
            ))}
          </div>
          <div className="eco-detail card" role="tabpanel" key={a.id}>
            <h3 className="h3">{a.name}</h3>
            <ol className="eco-steps">
              <li>
                <span className="mono">1</span>
                <div><h5>Where the processor is</h5><p>{a.where}</p></div>
              </li>
              <li>
                <span className="mono">2</span>
                <div><h5>What it does</h5><ul>{a.does.map((d) => <li key={d}>{d}</li>)}</ul></div>
              </li>
              <li>
                <span className="mono">3</span>
                <div><h5>Why ARM64 suits it</h5><p>{a.why}</p></div>
              </li>
              <li>
                <span className="mono">4</span>
                <div><h5>Real-world example</h5><p>{a.example}</p></div>
              </li>
            </ol>
            {a.careful ? <p className="note"><strong>Keep in mind.</strong> {a.careful}</p> : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
