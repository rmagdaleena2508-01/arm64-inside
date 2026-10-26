# ARM64 — Inside the Architecture

An interactive educational website about the ARM64 (AArch64) architecture, made for a Computer Organization and Architecture course.

- **Processor explorer**: an isometric teaching processor drawn with the [Anatomy](https://github.com/wheresryan22/anatomy) kit. It has Explore, Execute, Pipeline and Datapath modes, an exploded view, rotation and zoom.
- **Simulator**: a documented subset of A64 (MOV, ADD, SUB, AND, ORR, LDR, STR) with real operand checks and real 32-bit encodings, a five-stage teaching pipeline and small caches.
- **Sections**: what ARM64 is, the engineers behind it, its history, where it's used, why students should learn it, a learning lab and a quiz.

The processor model is educational. It isn't the design of any real chip.

## Run it

```bash
npm install
npm run dev     # http://localhost:8880
npm test        # simulator tests
npm run build
```

Stack: React, TypeScript, Vite, Tailwind CSS and the Anatomy isometric kit (MIT, in `src/kit`).
