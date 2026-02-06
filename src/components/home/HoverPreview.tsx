"use client";

import { useRef, useState, useEffect, useCallback } from "react";

const SCALE = 1.12;
const PAD = 8;

export function HoverPreview({
  children,
  panel,
  enabled = true,
  delaySec = 0.5,
  panelClassName,
}: {
  children: React.ReactNode;
  panel: React.ReactNode;
  enabled?: boolean;
  delaySec?: number;
  panelClassName?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayMs = Math.max(0, Math.floor(delaySec * 1000));

  const clamp = useCallback(() => {
    const panelEl = panelRef.current;
    if (!panelEl) return;
    const r = panelEl.getBoundingClientRect();
    let tx = 0,
      ty = 0;
    if (r.left < PAD) tx = PAD - r.left;
    if (r.right > innerWidth - PAD) tx = innerWidth - PAD - r.right;
    if (r.top < PAD) ty = PAD - r.top;
    if (r.bottom > innerHeight - PAD) ty = innerHeight - PAD - r.bottom;
    panelEl.style.transform = `scale(${SCALE}) translate(${tx}px, ${ty}px)`;
  }, []);

  const openPanel = useCallback(() => {
    setOpen((prev) => {
      if (prev) return prev;
      return true;
    });
  }, []);

  const closePanel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
    const panelEl = panelRef.current;
    if (panelEl) panelEl.style.transform = `scale(${SCALE}) translate(0,0)`;
  }, []);

  const start = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      openPanel();
    }, delayMs);
  }, [delayMs, openPanel]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    closePanel();
  }, [closePanel]);

  useEffect(() => {
    const root = rootRef.current;
    const panelEl = panelRef.current;
    if (!root || !panelEl) return;

    const isTouchLike = typeof window !== "undefined" && matchMedia("(hover: none), (pointer: coarse)").matches;
    if (!enabled || isTouchLike) {
      panelEl.setAttribute("aria-hidden", "true");
      return;
    }

    const baseLink = root.querySelector<HTMLElement>(":scope > .card");
    const focusHandler = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        openPanel();
      }, Math.min(250, delayMs));
    };

    root.addEventListener("mouseenter", start);
    root.addEventListener("mouseleave", cancel);
    baseLink?.addEventListener("focus", focusHandler);
    baseLink?.addEventListener("blur", cancel);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    root.addEventListener("keydown", onKey);
    const clampIfOpen = () => {
      if (root.classList.contains("is-open")) clamp();
    };
    window.addEventListener("resize", clampIfOpen);
    window.addEventListener("scroll", clampIfOpen, { passive: true });

    return () => {
      root.removeEventListener("mouseenter", start);
      root.removeEventListener("mouseleave", cancel);
      baseLink?.removeEventListener("focus", focusHandler);
      baseLink?.removeEventListener("blur", cancel);
      root.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", clampIfOpen);
      window.removeEventListener("scroll", clampIfOpen);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, start, cancel, openPanel, delayMs, clamp]);

  useEffect(() => {
    const root = rootRef.current;
    const panelEl = panelRef.current;
    if (!root || !panelEl) return;
    if (open) {
      root.classList.add("is-open");
      panelEl.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => clamp());
    } else {
      root.classList.remove("is-open");
      panelEl.setAttribute("aria-hidden", "true");
    }
  }, [open, clamp]);

  return (
    <div
      ref={rootRef}
      className="cv-hover"
      data-enabled={enabled ? "1" : "0"}
      data-hover-delay={delaySec}
    >
      {children}
      {enabled && (
        <div
          ref={panelRef}
          className={panelClassName ? `cv-hover__panel ${panelClassName}` : "cv-hover__panel"}
          aria-hidden={!open}
        >
          {panel}
        </div>
      )}
    </div>
  );
}
