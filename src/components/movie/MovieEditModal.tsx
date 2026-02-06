"use client";

import { useRouter } from "next/navigation";
import { useRef, useEffect } from "react";
import type { MovieDetail } from "@/lib/movie-data";
import { statusLabels } from "@/lib/enum-mapper";
import { priorityLabels } from "@/lib/enum-mapper";
import { mediaTypeLabels } from "@/lib/enum-mapper";
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
    const fd = new FormData(form);
    const payload: Record<string, unknown> = Object.fromEntries(fd.entries());
    ["vbSentAt", "vbReceivedAt"].forEach((k) => {
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
          <div className="fieldset">
            <div className="fieldset__legend">Allgemein</div>
            <div className="grid-2">
              <label>
                <span>Von Wem</span>
                <select name="assignedToUserId" defaultValue={movie.assignedToUser?.id ?? ""}>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} | {u.role}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select name="status" defaultValue={movie.status}>
                  {(Object.entries(statusLabels) as [Status, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </label>
              <label>
                <span>Priorität</span>
                <select name="priority" defaultValue={movie.priority}>
                  {(Object.entries(priorityLabels) as [Priority, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </label>
              <label>
                <span>Medientyp</span>
                <select name="mediaType" defaultValue={movie.mediaType ?? ""}>
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
              <label>
                <span>Qualität</span>
                <QualityField currentQ={currentQ} isKnown={isKnown} />
              </label>
            </div>
          </div>

          <div className="fieldset">
            <div className="fieldset__legend">Videobuster</div>
            <div className="grid-2">
              <label>
                <span>Ausgang</span>
                <div className="grid-2">
                  <input
                    type="date"
                    name="vbSentAt"
                    defaultValue={movie.ui.vbSentAt ?? ""}
                    className="input"
                  />
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => {
                      const inp = formRef.current?.querySelector(
                        'input[name="vbSentAt"]'
                      ) as HTMLInputElement;
                      if (inp) inp.value = new Date().toISOString().slice(0, 10);
                    }}
                  >
                    Heute
                  </button>
                </div>
              </label>
              <label>
                <span>Eingang</span>
                <div className="grid-2">
                  <input
                    type="date"
                    name="vbReceivedAt"
                    defaultValue={movie.ui.vbReceivedAt ?? ""}
                    className="input"
                  />
                  <button
                    type="button"
                    className="btn btn--primary"
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
              <label>
                <span>Videobuster URL</span>
                <input
                  type="url"
                  name="videobusterUrl"
                  defaultValue={movie.ui.videobusterUrl ?? ""}
                  placeholder="https://www.videobuster.de/..."
                  className="input"
                />
              </label>
            </div>
          </div>

          <div className="fieldset">
            <div className="fieldset__legend">Encoding</div>
            <div className="grid-2">
              <label>
                <span>Dateigröße vorher (Bytes)</span>
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
                  placeholder="z. B. 80530636800"
                  className="input"
                />
              </label>
              <label>
                <span>Dateigröße nachher (Bytes)</span>
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
                  placeholder="z. B. 69835161600"
                  className="input"
                />
              </label>
              <label>
                <span>SHA256 Checksum</span>
                <input
                  type="text"
                  name="checkSum"
                  defaultValue={movie.ui.checkSum ?? ""}
                  placeholder="z. B. b309e13ba9a40763964a388c..."
                  className="input"
                />
              </label>
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
        className="input"
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
          className="input"
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
