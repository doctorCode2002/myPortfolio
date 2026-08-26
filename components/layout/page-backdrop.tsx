import type { ReactNode } from "react";

import { ShaderFlow } from "../shaders/shader-flow";

export function PageBackdrop(): ReactNode {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-225 overflow-hidden"
    >
      <div className="absolute inset-0 opacity-50 md:opacity-100">
        {/* brightness stays near 1: the terracotta high stop clips to a washed
            grey-white much above that, which drains the palette out of the
            backdrop entirely. */}
        <ShaderFlow brightness={1.35} iterations={10} flowSpeed={[0, 0.1]} />
      </div>
    </div>
  );
}
