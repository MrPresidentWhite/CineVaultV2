/**
 * Icon für Gerätetyp: Desktop, Mobile oder Web (Fallback).
 * Einheitliche Darstellung in der Geräte-Übersicht.
 */
type DeviceType = "desktop" | "mobile" | "web";

type Props = {
  type: DeviceType;
  className?: string;
};

const iconClass = "w-10 h-10 shrink-0 text-text/70";

export function DeviceIcon({ type, className }: Props) {
  const combined = className ? `${iconClass} ${className}` : iconClass;

  if (type === "desktop") {
    return (
      <span className={combined} aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8" />
          <path d="M12 17v4" />
        </svg>
      </span>
    );
  }

  if (type === "mobile") {
    return (
      <span className={combined} aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M12 18h.01" />
        </svg>
      </span>
    );
  }

  // web / fallback: Browser/Globe
  return (
    <span className={combined} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    </span>
  );
}
