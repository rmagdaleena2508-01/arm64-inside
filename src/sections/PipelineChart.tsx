import type { Instr } from "../sim/isa";
import type { PipeRow } from "../sim/machine";

interface Props {
  instrs: Instr[];
  pipe: { rows: PipeRow[]; cycles: number; stalls: number };
  cycle: number;
  onCycle: (c: number) => void;
}

export function PipelineChart({ instrs, pipe, cycle, onCycle }: Props) {
  const cols = Array.from({ length: pipe.cycles }, (_, c) => c);
  const sequential = instrs.length * 5;
  return (
    <div className="pipe">
      <header className="panel-head">
        <h4>Five-stage pipeline</h4>
        <span className="mono small">{cycle < 0 ? "reset" : `cycle ${cycle + 1}`}</span>
      </header>
      <div className="pipe-scroll">
        <table className="pipe-table">
          <thead>
            <tr>
              <th scope="col" className="sr-only">Instruction</th>
              {cols.map((c) => (
                <th key={c} scope="col">
                  <button className="mono cyc" data-on={c === cycle ? "" : undefined} onClick={() => onCycle(c)} aria-label={`Go to cycle ${c + 1}`}>
                    {c + 1}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pipe.rows.map((row) => (
              <tr key={row.instr}>
                <th scope="row" className="mono">{instrs[row.instr]?.text}</th>
                {cols.map((c) => {
                  const s = row.cells[c];
                  return (
                    <td key={c} data-stage={s ?? undefined} data-now={c === cycle ? "" : undefined} data-past={c < cycle ? "" : undefined}>
                      {s ? <span className="mono">{s === "stall" ? "·" : s}</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small">
        {instrs.length} instructions finish in {pipe.cycles} steps instead of {sequential} done one at a time
        {pipe.stalls ? `, including ${pipe.stalls} stall${pipe.stalls > 1 ? "s" : ""} where an instruction needs a value that a load hasn't delivered yet` : ""}.
      </p>
      <p className="muted small">
        Teaching model: one stage per step, with forwarding so an ALU result can feed the next instruction straight away. These steps aren't real clock cycles of any ARM64 processor. The architecture doesn't require a pipeline at all, and real cores use deeper, wider and out-of-order designs.
      </p>
    </div>
  );
}
