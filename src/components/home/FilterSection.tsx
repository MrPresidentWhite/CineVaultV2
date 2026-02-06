"use client";

import { useState, useEffect } from "react";

/**
 * Auf Mobile eingeklappt, auf Desktop ausgeklappt.
 * Umfasst Filter-Grid und Filter-Actions.
 */
export function FilterSection({
  summary,
  children,
}: {
  summary: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const m = window.matchMedia("(min-width: 640px)");
    if (!m.matches) setOpen(false);
    const handler = () => setOpen(m.matches);
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, []);

  return (
    <details open={open} className="filter-details">
      <summary className="filter-summary">{summary}</summary>
      {children}
    </details>
  );
}
