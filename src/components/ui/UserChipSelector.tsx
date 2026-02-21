"use client";

/**
 * Chip-Selector für User-Auswahl (Zugewiesen / Weitere zugewiesene).
 * Chips in Rollen-Farben (Admin, Editor, Viewer); Klick wählt ab/zu.
 */

export type UserChip = {
  id: number;
  name: string;
  role: string;
};

type Props = {
  users: UserChip[];
  /** Einzelauswahl: gewählte User-ID oder null. */
  selectedId?: number | null;
  /** Mehrfachauswahl: gewählte User-IDs. */
  selectedIds?: number[];
  /** Mehrfachauswahl: diese IDs nicht anzeigen (z. B. Primär-Zugewiesener). */
  excludeIds?: number[];
  /** Einzelauswahl: onChange(id | null). */
  onSelect?: (id: number | null) => void;
  /** Mehrfachauswahl: onChange(ids). */
  onSelectMultiple?: (ids: number[]) => void;
  /** "single" = eine Person (z. B. Zugewiesen), "multi" = mehrere (Weitere zugewiesene). */
  mode: "single" | "multi";
  /** Optionale Beschriftung. */
  label?: string;
  /** Optionale Hilfstext-Zeile. */
  hint?: string;
  className?: string;
};

function chipRoleClass(role: string): string {
  const r = role.toLowerCase();
  if (r === "admin") return "user-chip--admin";
  if (r === "editor") return "user-chip--editor";
  return "user-chip--viewer";
}

export function UserChipSelector({
  users,
  selectedId = null,
  selectedIds = [],
  excludeIds = [],
  onSelect,
  onSelectMultiple,
  mode,
  label,
  hint,
  className = "",
}: Props) {
  const isSingle = mode === "single";
  const visibleUsers = excludeIds.length
    ? users.filter((u) => !excludeIds.includes(u.id))
    : users;

  const handleClick = (id: number) => {
    if (isSingle) {
      if (selectedId === id) onSelect?.(null);
      else onSelect?.(id);
    } else {
      const set = new Set(selectedIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      onSelectMultiple?.([...set]);
    }
  };

  return (
    <div className={`block ${className}`}>
      {label && (
        <span className="mb-1 block text-sm text-text/70">{label}</span>
      )}
      <div className="flex flex-wrap gap-2">
        {visibleUsers.map((u) => {
          const selected = isSingle
            ? selectedId === u.id
            : selectedIds.includes(u.id);
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => handleClick(u.id)}
              className={`user-chip ${chipRoleClass(u.role)} ${selected ? "user-chip--selected" : "user-chip--outline"}`}
              title={selected && isSingle ? "Klicken zum Abwählen" : "Klicken zum Auswählen"}
            >
              <span className="user-chip__name">{u.name}</span>
              <span className="user-chip__role">{u.role}</span>
            </button>
          );
        })}
        {isSingle && visibleUsers.length === 0 && (
          <span className="text-sm text-text/50">Keine weiteren Nutzer</span>
        )}
      </div>
      {hint && (
        <small className="mt-1 block text-text/60">{hint}</small>
      )}
    </div>
  );
}
