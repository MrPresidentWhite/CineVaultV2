"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QuickActionItem } from "@/lib/quick-actions";
import { getAccentFromEmoji } from "@/lib/quick-actions";
import {
  type QuickActionRoute,
  getBasePath,
  parseHrefParams,
  buildHrefWithParams,
} from "@/lib/quick-actions-routes";

/** Emojis für den Picker (häufig genutzte für Quick Actions). */
const EMOJI_GRID = [
  "📥", "📤", "🔎", "📂", "📁", "👤", "👥", "📊", "📈", "🛠️",
  "🔐", "📋", "🎬", "🍿", "⭐", "❤️", "🔥", "🏠", "⚙️", "📝",
  "✏️", "🔗", "🏷️", "📌", "✅", "🎯", "🚀", "💡", "🔔", "📧",
];

type Props = {
  initialItems: QuickActionItem[];
  allowedRoutes: QuickActionRoute[];
};

export function QuickActionsForm({ initialItems, allowedRoutes }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<QuickActionItem[]>(initialItems);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [emojiPickerFor, setEmojiPickerFor] = useState<number | null>(null);

  const defaultHref = allowedRoutes[0]?.href ?? "/movies";

  function updateItem(index: number, patch: Partial<QuickActionItem>) {
    setItems((prev) => {
      const next = [...prev];
      const cur = next[index];
      if (!cur) return prev;
      const updated = { ...cur, ...patch };
      if (patch.icon != null && !patch.accent) {
        updated.accent = getAccentFromEmoji(patch.icon);
      }
      next[index] = updated;
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        href: defaultHref,
        title: allowedRoutes.find((r) => r.href === defaultHref)?.label ?? "Neuer Link",
        desc: "Beschreibung",
        icon: "🔗",
        accent: getAccentFromEmoji("🔗"),
      },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setEmojiPickerFor(null);
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    setItems((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    if (index >= items.length - 1) return;
    setItems((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  const hasChanges =
    JSON.stringify(items) !== JSON.stringify(initialItems);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");
    try {
      const res = await fetch("/api/profile/quick-actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("ok");
        router.refresh();
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("error");
        setError(data.error ?? "Speichern fehlgeschlagen");
      }
    } catch {
      setStatus("error");
      setError("Netzwerkfehler");
    }
  }

  return (
    <section className="rounded-xl border border-ring bg-panel p-6">
      <form onSubmit={save} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-brand-ruby/50 bg-brand-ruby/10 px-4 py-3 text-sm text-brand-ruby">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {items.map((item, index) => (
            <article
              key={index}
              className="rounded-xl border border-ring bg-bg/30 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEmojiPickerFor(emojiPickerFor === index ? null : index)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl border border-ring bg-bg hover:border-accent/60 transition"
                    style={{
                      background: `color-mix(in oklab, ${item.accent} 14%, transparent)`,
                      boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${item.accent} 40%, #000 60%)`,
                    }}
                    title="Emoji wählen"
                  >
                    {item.icon}
                  </button>
                  <div className="min-w-0">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => updateItem(index, { title: e.target.value })}
                      placeholder="Titel"
                      className="w-full rounded-lg border border-ring bg-bg px-3 py-1.5 text-sm font-medium text-text outline-none focus:border-accent"
                    />
                    <input
                      type="text"
                      value={item.desc}
                      onChange={(e) => updateItem(index, { desc: e.target.value })}
                      placeholder="Kurzbeschreibung"
                      className="mt-1 w-full rounded-lg border border-ring bg-bg px-3 py-1 text-xs text-text/80 outline-none focus:border-accent"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="rounded-lg border border-ring bg-bg p-1.5 text-text/70 hover:bg-bg/80 hover:text-text disabled:opacity-40 disabled:pointer-events-none"
                    title="Nach oben"
                    aria-label="Nach oben"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === items.length - 1}
                    className="rounded-lg border border-ring bg-bg p-1.5 text-text/70 hover:bg-bg/80 hover:text-text disabled:opacity-40 disabled:pointer-events-none"
                    title="Nach unten"
                    aria-label="Nach unten"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="rounded-lg border border-ring bg-bg p-1.5 text-brand-ruby/80 hover:bg-brand-ruby/10"
                    title="Entfernen"
                    aria-label="Entfernen"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {emojiPickerFor === index && (
                <div className="rounded-lg border border-ring bg-bg/50 p-3">
                  <p className="mb-2 text-xs font-medium text-text/70">
                    Emoji wählen (Farbe wird daraus abgeleitet)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJI_GRID.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          updateItem(index, { icon: emoji });
                          setEmojiPickerFor(null);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-lg border border-ring bg-bg hover:border-accent/60 hover:bg-accent/10 transition"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-xs text-text/70">Eigenes:</label>
                    <input
                      type="text"
                      maxLength={8}
                      placeholder="z. B. 🎬"
                      className="w-24 rounded-md border border-ring bg-bg px-2 py-1 text-sm text-text outline-none focus:border-accent"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = (e.target as HTMLInputElement).value.trim();
                          if (v) {
                            updateItem(index, { icon: v });
                            (e.target as HTMLInputElement).value = "";
                            setEmojiPickerFor(null);
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              <label className="block">
                <span className="mb-0.5 block text-xs text-text/70">Ziel (Route)</span>
                <select
                  value={getBasePath(item.href)}
                  onChange={(e) => updateItem(index, { href: e.target.value })}
                  className="w-full rounded-lg border border-ring bg-bg px-3 py-1.5 text-sm text-text outline-none focus:border-accent"
                >
                  {allowedRoutes.map((r) => (
                    <option key={r.href} value={r.href}>
                      {r.label} ({r.href})
                    </option>
                  ))}
                </select>
              </label>

              {(() => {
                const basePath = getBasePath(item.href);
                const route = allowedRoutes.find((r) => r.href === basePath);
                if (!route?.filters?.length) return null;
                const currentParams = parseHrefParams(item.href);
                return (
                  <div className="rounded-lg border border-ring/60 bg-bg/30 p-3 space-y-3">
                    <p className="text-xs font-medium text-text/70">
                      Filter (optional) – nur anwenden, wenn der Link vorgefiltert öffnen soll
                    </p>
                    {route.filters.map((filter) => (
                      <div key={filter.param}>
                        <span className="mb-1.5 block text-xs text-text/60">
                          {filter.label}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {filter.options.map((opt) => {
                            const selected = (currentParams[filter.param] ?? []).includes(opt.value);
                            return (
                              <label
                                key={opt.value}
                                className="flex items-center gap-1.5 rounded-md border border-ring bg-bg px-2.5 py-1.5 text-xs text-text/90 has-[:checked]:border-accent/60 has-[:checked]:bg-accent/10 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => {
                                    const next = { ...currentParams };
                                    if (filter.multi) {
                                      const arr = next[filter.param] ?? [];
                                      if (arr.includes(opt.value)) {
                                        next[filter.param] = arr.filter((v) => v !== opt.value);
                                      } else {
                                        next[filter.param] = [...arr, opt.value];
                                      }
                                    } else {
                                      next[filter.param] = selected ? [] : [opt.value];
                                    }
                                    const newHref = buildHrefWithParams(basePath, next);
                                    updateItem(index, { href: newHref });
                                  }}
                                  className="rounded border-ring text-accent focus:ring-accent"
                                />
                                {opt.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </article>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={addItem}
            className="rounded-lg border border-dashed border-ring bg-bg/30 px-4 py-2 text-sm font-medium text-text/70 hover:border-accent/60 hover:bg-accent/10 hover:text-text transition"
          >
            + Quick Action hinzufügen
          </button>
          <button
            type="submit"
            disabled={!hasChanges || status === "loading"}
            className="rounded-lg border border-accent bg-accent/20 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/30 disabled:opacity-50 disabled:pointer-events-none"
          >
            {status === "loading"
              ? "Speichern …"
              : status === "ok"
                ? "Gespeichert."
                : "Speichern"}
          </button>
        </div>
      </form>
    </section>
  );
}
