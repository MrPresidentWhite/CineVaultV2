"use client";

import { useId, useState } from "react";

type Props = {
  overview: string;
  className?: string;
};

export function OverviewToggle({ overview, className }: Props) {
  const [clamped, setClamped] = useState(true);
  const id = useId();

  return (
    <>
      <p
        id={id}
        className={className}
        data-clamped={clamped ? "true" : "false"}
        role="region"
        aria-label="Collection-Beschreibung"
      >
        {overview}
      </p>
      <button
        type="button"
        className="btn btn--tiny btn--ghost overview-toggle"
        onClick={() => setClamped((c) => !c)}
        aria-expanded={!clamped}
        aria-controls={id}
      >
        {clamped ? "Mehr anzeigen" : "Weniger anzeigen"}
      </button>
    </>
  );
}
