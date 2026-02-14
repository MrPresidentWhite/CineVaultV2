"use client";

import { useRouter } from "next/navigation";
import { useRef, useEffect, useCallback } from "react";
import type { SeriesDetailEpisode } from "@/lib/series-data";

type Props = {
  episode: SeriesDetailEpisode;
  onClose: () => void;
};

export function EpisodeEditModal({ episode, onClose }: Props) {
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const closeModal = useCallback(() => {
    if (!modalRef.current) return;
    modalRef.current.hidden = true;
    modalRef.current.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("modal-open");
    document.body.classList.remove("modal-open");
    onClose();
  }, [onClose]);

  useEffect(() => {
    const modal = modalRef.current;
    const dialog = dialogRef.current;
    if (!modal || !dialog) return;
    modal.hidden = false;
    modal.removeAttribute("aria-hidden");
    document.documentElement.classList.add("modal-open");
    document.body.classList.add("modal-open");

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
  }, [episode.id, closeModal]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;

    const sizeAfterVal = (form.querySelector('input[name="sizeAfterBytes"]') as HTMLInputElement)?.value?.trim() ?? "";
    const sizeBeforeVal = (form.querySelector('input[name="sizeBeforeBytes"]') as HTMLInputElement)?.value?.trim() ?? "";
    const sizeAfterNum = sizeAfterVal ? Number(sizeAfterVal) : 0;
    const sizeBeforeNum = sizeBeforeVal ? Number(sizeBeforeVal) : 0;
    if (sizeAfterNum > 0 && sizeBeforeNum <= 0) {
      alert("Wenn „Größe nachher“ ausgefüllt ist, muss auch „Größe vorher“ ausgefüllt sein.");
      return;
    }

    const fd = new FormData(form);
    const payload: Record<string, unknown> = Object.fromEntries(fd.entries());
    try {
      const res = await fetch(`/api/series/episode/${episode.id}/update`, {
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

  const title = episode.title || `Episode ${episode.episodeNumber}`;

  return (
    <div
      ref={modalRef}
      id="episodeEditModal"
      className="modal"
      aria-hidden="false"
    >
      <div className="modal__backdrop" data-close aria-hidden />
      <div
        ref={dialogRef}
        className="modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="episodeEditTitle"
      >
        <div className="modal__header">
          <h3 id="episodeEditTitle">
            Folge bearbeiten: S{episode.seasonNumber}E{episode.episodeNumber} – {title}
          </h3>
          <button
            type="button"
            className="modal__close"
            data-close
            aria-label="Schließen"
            onClick={closeModal}
          >
            &times;
          </button>
        </div>
        <form
          ref={formRef}
          id="episodeEditForm"
          className="modal__body"
          onSubmit={handleSubmit}
        >
          <div className="fieldset">
            <div className="fieldset__legend">Encoding</div>
            <div className="grid-2">
              <label>
                <span>Dateigröße vorher (Bytes)</span>
                <input
                  type="number"
                  name="sizeBeforeBytes"
                  defaultValue={
                    episode.sizeBeforeBytes != null
                      ? String(episode.sizeBeforeBytes)
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
                    episode.sizeAfterBytes != null
                      ? String(episode.sizeAfterBytes)
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
                  defaultValue={episode.checkSum ?? ""}
                  placeholder="z. B. b309e13ba9a40763964a388c..."
                  className="input"
                />
              </label>
              <label>
                <span>Laufzeit (Minuten)</span>
                <input
                  type="number"
                  name="runtimeMin"
                  defaultValue={
                    episode.runtimeMin != null ? String(episode.runtimeMin) : ""
                  }
                  min={0}
                  inputMode="numeric"
                  placeholder="z. B. 42"
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
