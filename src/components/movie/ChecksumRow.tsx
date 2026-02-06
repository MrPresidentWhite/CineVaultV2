"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = { checkSum: string };

export function ChecksumRow({ checkSum }: Props) {
  const short =
    checkSum.length > 20
      ? `${checkSum.slice(0, 10)}…${checkSum.slice(-10)}`
      : checkSum;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState({ left: 16, top: 16 });
  const showBtnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLElement>(null);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const openPopover = useCallback(() => {
    const btn = showBtnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const width = Math.min(680, window.innerWidth - 32);
    const left = Math.min(
      Math.max(16, r.left + r.width / 2 - width / 2),
      window.innerWidth - width - 16
    );
    const top = Math.min(r.bottom + 12, window.innerHeight - 160);
    setPopoverStyle({ left, top });
    setPopoverOpen(true);
  }, []);

  const closePopover = useCallback(() => setPopoverOpen(false), []);

  useEffect(() => {
    if (!popoverOpen || !codeRef.current) return;
    codeRef.current.textContent = checkSum;
    const inner = popoverRef.current?.querySelector(".hash-popover__inner");
    (inner as HTMLElement)?.focus();
  }, [popoverOpen, checkSum]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && popoverOpen) closePopover();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [popoverOpen, closePopover]);

  return (
    <>
      <li className="checksum-row">
        <span>SHA256 Checksum</span>
        <strong className="checksum">
          <span className="checksum__short">{short}</span>
          <button
            type="button"
            className="btn btn--tiny btn--ghost copy-btn"
            onClick={() => {
              copyToClipboard(checkSum);
            }}
          >
            Kopieren
          </button>
          <button
            ref={showBtnRef}
            type="button"
            className="btn btn--tiny btn--ghost show-hash"
            onClick={openPopover}
          >
            Anzeigen
          </button>
        </strong>
      </li>
      <div
        ref={popoverRef}
        id="hashPopover"
        className="hash-popover"
        hidden={!popoverOpen}
        style={{
          left: popoverStyle.left,
          top: popoverStyle.top,
        }}
      >
        <div
          className="hash-popover__inner"
          role="dialog"
          aria-modal="true"
          aria-label="SHA256 Checksum"
          tabIndex={-1}
          onKeyDown={(e) => e.key === "Escape" && closePopover()}
        >
          <div className="hash-popover__title">SHA256 Checksum</div>
          <code ref={codeRef} id="hashFull" className="hash-popover__code" />
          <div className="hash-popover__actions">
            <button
              type="button"
              className="btn btn--sm copy-full"
              onClick={() => {
                copyToClipboard(checkSum);
              }}
            >
              Kopieren
            </button>
            <button
              type="button"
              className="btn btn--sm"
              data-close
              onClick={closePopover}
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
