"use client";

import { useRouter } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import type { MovieDetail } from "@/lib/movie-data";
import { statusLabels, USER_SELECTABLE_STATUSES } from "@/lib/enum-mapper";
import { priorityLabels } from "@/lib/enum-mapper";
import { mediaTypeLabels } from "@/lib/enum-mapper";
import {
  hasSizeValidationError,
  SIZE_VALIDATION_ERROR_MESSAGE,
} from "@/lib/movie-size-validation";
import type { Status, Priority, MediaType } from "@/generated/prisma/enums";

const KNOWN_QUALITIES = ["720p", "1080p", "1440p", "2160p"] as const;

type Props = {
  movie: MovieDetail;
  users: { id: number; name: string; email: string; role: string }[];
};

export function MovieEditModal({ movie, users }: Props) {
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>(movie.status as Status);

  const closeModal = () => {
    if (!modalRef.current) return;
    modalRef.current.hidden = true;
    modalRef.current.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("modal-open");
    document.body.classList.remove("modal-open");
  };

  useEffect(() => {
    const modal = modalRef.current;
    const dialog = dialogRef.current;
    if (!modal || !dialog) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
      }
    };
    const onBackdrop = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".modal__backdrop")) closeModal();
    };
    const onCloseBtn = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-close]")) closeModal();
    };

    modal.addEventListener("keydown", onKey);
    modal.addEventListener("click", onBackdrop);
    modal.addEventListener("click", onCloseBtn);
    return () => {
      modal.removeEventListener("keydown", onKey);
      modal.removeEventListener("click", onBackdrop);
      modal.removeEventListener("click", onCloseBtn);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;

    const vbSentAt = (form.querySelector('input[name="vbSentAt"]') as HTMLInputElement)?.value?.trim() ?? "";
    const vbReceivedAt = (form.querySelector('input[name="vbReceivedAt"]') as HTMLInputElement)?.value?.trim() ?? "";
    const statusScheduledAt = (form.querySelector('input[name="statusScheduledAt"]') as HTMLInputElement)?.value?.trim() ?? "";

    const isValidDateValue = (val: string): boolean =>
      val === "" || !Number.isNaN(new Date(val).getTime());

    if (!isValidDateValue(vbSentAt)) {
      alert("Bitte ein gültiges Datum für „Ausgang“ eingeben (z. B. JJJJ-MM-TT).");
      return;
    }
    if (!isValidDateValue(vbReceivedAt)) {
      alert("Bitte ein gültiges Datum für „Eingang“ eingeben (z. B. JJJJ-MM-TT).");
      return;
    }
    if (status === "VO_SOON" && statusScheduledAt && !isValidDateValue(statusScheduledAt)) {
      alert("Bitte ein gültiges Datum für „Ab Datum → Auf Wunschliste“ eingeben.");
      return;
    }

    const sizeAfterVal = (form.querySelector('input[name="sizeAfterBytes"]') as HTMLInputElement)?.value?.trim() ?? "";
    const sizeBeforeVal = (form.querySelector('input[name="sizeBeforeBytes"]') as HTMLInputElement)?.value?.trim() ?? "";
    const sizeAfterNum = sizeAfterVal ? Number(sizeAfterVal) : 0;
    const sizeBeforeNum = sizeBeforeVal ? Number(sizeBeforeVal) : 0;
    if (hasSizeValidationError(sizeAfterNum, sizeBeforeNum)) {
      alert(SIZE_VALIDATION_ERROR_MESSAGE);
      return;
    }

    const fd = new FormData(form);
    const payload: Record<string, unknown> = Object.fromEntries(fd.entries());
    ["vbSentAt", "vbReceivedAt", "statusScheduledAt"].forEach((k) => {
      if (!payload[k]) payload[k] = "";
    });
    try {
      const res = await fetch(`/api/movies/${movie.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        closeModal();
        router.refresh();
      } else {
        alert(data.error || "Speichern fehlgeschlagen.");
      }
    } catch (err) {
      console.error(err);
      alert("Speichern fehlgeschlagen.");
    }
  };

  const currentQ = movie.ui.quality || "";
  const isKnown = KNOWN_QUALITIES.includes(currentQ as (typeof KNOWN_QUALITIES)[number]);

  return (
    <div
      ref={modalRef}
      id="editModal"
      className="modal"
      aria-hidden="true"
      hidden
    >
      <div className="modal__backdrop" data-close aria-hidden />
      <div
        ref={dialogRef}
        className="modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editTitle"
      >
        <div className="modal__header">
          <h3 id="editTitle">Film bearbeiten</h3>
          <button type="button" className="modal__close" data-close aria-label="Schließen">
            &times;
          </button>
        </div>
        <form
          ref={formRef}
          id="editForm"
          className="modal__body"
          onSubmit={handleSubmit}
        >
          <div className="rounded-xl border border-ring bg-panel p-5 mt-4 first:mt-0">
            <h4 className="text-lg font-semibold text-text">Allgemein</h4>
            <div className="mt-4 flex flex-col gap-4">
              <label className="block">
                <span className="block text-sm text-text/70 mb-1">Zugewiesen</span>
                <select name="assignedToUserId" className="input w-full" defaultValue={movie.assignedToUser?.id ?? ""}>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} | {u.role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-sm text-text/70 mb-1">Status</span>
                <select
                  name="status"
                  className="input w-full"
                  value={status}
                  onChange={(e) => {
                    const v = e.target.value as Status;
                    setStatus(v);
                    if (v === "SHIPPING") {
                      const today = new Date().toISOString().slice(0, 10);
                      const sent = formRef.current?.querySelector('input[name="vbSentAt"]') as HTMLInputElement;
                      if (sent) sent.value = today;
                    }
                  }}
                >
                  {USER_SELECTABLE_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {statusLabels[value]}
                    </option>
                  ))}
                </select>
              </label>
              {status === "VO_SOON" && (
                <label className="block">
                  <span className="block text-sm text-text/70 mb-1">Ab diesem Datum → Auf Wunschliste</span>
                  <input
                    type="date"
                    name="statusScheduledAt"
                    defaultValue={movie.ui.statusScheduledAt ?? ""}
                    className="input w-full"
                  />
                  <small className="block text-text/60 mt-1">
                    Wird das Datum erreicht, setzt ein Cron-Job den Status automatisch auf „Auf Wunschliste“ (optional: Benachrichtigung).
                  </small>
                </label>
              )}
              <label className="block">
                <span className="block text-sm text-text/70 mb-1">Priorität</span>
                <select name="priority" className="input w-full" defaultValue={movie.priority}>
                  {(Object.entries(priorityLabels) as [Priority, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </label>
              <label className="block">
                <span className="block text-sm text-text/70 mb-1">Medientyp</span>
                <select name="mediaType" className="input w-full" defaultValue={movie.mediaType ?? ""}>
                  <option value="">–</option>
                  {(Object.entries(mediaTypeLabels) as [MediaType, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </label>
              <label className="block">
                <span className="block text-sm text-text/70 mb-1">Qualität</span>
                <QualityField currentQ={currentQ} isKnown={isKnown} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="rounded-xl border border-ring bg-panel p-5 min-w-0">
              <h4 className="text-lg font-semibold text-text">Videobuster</h4>
              <div className="mt-4 flex flex-col gap-4">
                <label className="block">
                  <span className="block text-sm text-text/70 mb-1">Ausgang</span>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      name="vbSentAt"
                      defaultValue={movie.ui.vbSentAt ?? ""}
                      className="input w-full flex-1 min-w-0"
                    />
                    <button
                      type="button"
                      className="btn btn--primary btn--compact shrink-0"
                      onClick={() => {
                        const inp = formRef.current?.querySelector(
                          'input[name="vbSentAt"]'
                        ) as HTMLInputElement;
                        if (inp) inp.value = new Date().toISOString().slice(0, 10);
                        // Set status to "Im Versand" when no higher status yet
                        const statusesBeforeShipping: Status[] = [
                          "ON_WATCHLIST",
                          "VO_UNKNOWN",
                          "VO_SOON",
                          "VB_WISHLIST",
                        ];
                        if (statusesBeforeShipping.includes(status)) {
                          setStatus("SHIPPING");
                        }
                      }}
                    >
                      Heute
                    </button>
                  </div>
                </label>
                <label className="block">
                  <span className="block text-sm text-text/70 mb-1">Eingang</span>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      name="vbReceivedAt"
                      defaultValue={movie.ui.vbReceivedAt ?? ""}
                      className="input w-full flex-1 min-w-0"
                    />
                    <button
                      type="button"
                      className="btn btn--primary btn--compact shrink-0"
                      onClick={() => {
                        const inp = formRef.current?.querySelector(
                          'input[name="vbReceivedAt"]'
                        ) as HTMLInputElement;
                        if (inp) inp.value = new Date().toISOString().slice(0, 10);
                      }}
                    >
                      Heute
                    </button>
                  </div>
                </label>
                <label className="block">
                  <span className="block text-sm text-text/70 mb-1">Videobuster URL</span>
                  <input
                    type="url"
                    name="videobusterUrl"
                    defaultValue={movie.ui.videobusterUrl ?? ""}
                    placeholder="https://www.videobuster.de/..."
                    className="input w-full"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-ring bg-panel p-5 min-w-0">
              <h4 className="text-lg font-semibold text-text">Encoding</h4>
              <div className="mt-4 flex flex-col gap-4">
                <label className="block">
                  <span className="block text-sm text-text/70 mb-1">Größe vorher</span>
                  <input
                    type="number"
                    name="sizeBeforeBytes"
                    defaultValue={
                      movie.sizeBeforeBytes != null
                        ? String(movie.sizeBeforeBytes)
                        : ""
                    }
                    min={0}
                    inputMode="numeric"
                    placeholder="Bytes, z. B. 80530636800"
                    className="input w-full"
                  />
                </label>
                <label className="block">
                  <span className="block text-sm text-text/70 mb-1">Größe nachher</span>
                  <input
                    type="number"
                    name="sizeAfterBytes"
                    defaultValue={
                      movie.sizeAfterBytes != null
                        ? String(movie.sizeAfterBytes)
                        : ""
                    }
                    min={0}
                    inputMode="numeric"
                    placeholder="Bytes, z. B. 69835161600"
                    className="input w-full"
                  />
                </label>
                <label className="block">
                  <span className="block text-sm text-text/70 mb-1">SHA256</span>
                  <input
                    type="text"
                    name="checkSum"
                    defaultValue={movie.ui.checkSum ?? ""}
                    placeholder="z. B. b309e13ba9a40763964a388c..."
                    className="input w-full"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="modal__footer">
            <button type="button" className="btn" data-close onClick={closeModal}>
              Abbrechen
            </button>
            <button type="submit" className="btn btn--primary">
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QualityField({
  currentQ,
  isKnown,
}: {
  currentQ: string;
  isKnown: boolean;
}) {
  const selectValue = isKnown ? currentQ : (currentQ ? "__CUSTOM__" : KNOWN_QUALITIES[0]);
  return (
    <>
      <select
        id="qualitySelect"
        className="input w-full"
        defaultValue={selectValue}
        onChange={(e) => {
          const wrap = document.getElementById("qualityCustomWrap");
          const hid = document.getElementById("qualityHidden") as HTMLInputElement;
          const inp = document.getElementById("qualityCustom") as HTMLInputElement;
          if (e.target.value === "__CUSTOM__") {
            if (wrap) wrap.style.display = "";
            if (hid && inp) hid.value = inp.value.trim();
          } else {
            if (wrap) wrap.style.display = "none";
            if (hid) hid.value = e.target.value;
          }
        }}
      >
        {KNOWN_QUALITIES.map((q) => (
          <option key={q} value={q}>
            {q}
          </option>
        ))}
        <option value="__CUSTOM__">Benutzerdefiniert …</option>
      </select>
      <div
        id="qualityCustomWrap"
        style={{
          display: !isKnown && currentQ ? "block" : "none",
          marginTop: "0.5rem",
        }}
      >
        <input
          id="qualityCustom"
          type="text"
          className="input w-full"
          placeholder="z. B. 567p, 1080p (IMAX), …"
          defaultValue={!isKnown ? currentQ : ""}
          onChange={() => {
            const sel = document.getElementById("qualitySelect") as HTMLSelectElement;
            const hid = document.getElementById("qualityHidden") as HTMLInputElement;
            const inp = document.getElementById("qualityCustom") as HTMLInputElement;
            if (sel?.value === "__CUSTOM__" && hid && inp) hid.value = inp.value.trim();
          }}
        />
        <small className="muted block mt-1">
          Freie Eingabe. Wird verwendet, wenn „Benutzerdefiniert“ gewählt ist.
        </small>
      </div>
      <input type="hidden" name="quality" id="qualityHidden" defaultValue={currentQ} />
    </>
  );
}
