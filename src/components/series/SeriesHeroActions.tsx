"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";

type ButtonStatus = "idle" | "loading" | "success" | "error";

const FILL_ANIMATION_MS = 1400;
const DELAY_BEFORE_RESET_MS = 1000;
const FALLBACK_RESET_MS = FILL_ANIMATION_MS + DELAY_BEFORE_RESET_MS + 500;

type Props = {
  seriesId: number;
  canAdmin: boolean;
};

export function SeriesHeroActions({ seriesId, canAdmin }: Props) {
  const router = useRouter();
  const [imagesStatus, setImagesStatus] = useState<ButtonStatus>("idle");
  const [metaStatus, setMetaStatus] = useState<ButtonStatus>("idle");
  const fallbackImagesRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackMetaRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleFallbackReset = (
    setter: (s: ButtonStatus) => void,
    ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  ) => {
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(() => {
      setter("idle");
      ref.current = null;
    }, FALLBACK_RESET_MS);
  };

  const handleRefetchImages = async () => {
    setImagesStatus("loading");
    try {
      const res = await fetch(`/api/series/${seriesId}/refetch-images`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      router.refresh();
      setImagesStatus("success");
      scheduleFallbackReset(setImagesStatus, fallbackImagesRef);
    } catch (e) {
      console.error(e);
      setImagesStatus("error");
      scheduleFallbackReset(setImagesStatus, fallbackImagesRef);
    }
  };

  const handleRefetchMeta = async () => {
    setMetaStatus("loading");
    try {
      const res = await fetch(`/api/series/${seriesId}/refetch-meta`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      router.refresh();
      setMetaStatus("success");
      scheduleFallbackReset(setMetaStatus, fallbackMetaRef);
    } catch (e) {
      console.error(e);
      setMetaStatus("error");
      scheduleFallbackReset(setMetaStatus, fallbackMetaRef);
    }
  };

  const handleFillAnimationEnd = (
    e: React.AnimationEvent,
    setter: (s: ButtonStatus) => void,
    ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  ) => {
    if (e.animationName === "btn-fill-success" || e.animationName === "btn-fill-danger") {
      if (ref.current) clearTimeout(ref.current);
      ref.current = null;
      setTimeout(() => setter("idle"), DELAY_BEFORE_RESET_MS);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Serie wirklich löschen? Alle Staffeln, Episoden und zugehörigen Dateien werden ebenfalls gelöscht! Dies kann nicht rückgängig gemacht werden."
      )
    )
      return;
    try {
      const res = await fetch(`/api/series/${seriesId}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.ok) {
        alert("Serie erfolgreich gelöscht");
        window.location.href = "/series";
      } else {
        alert("Löschen fehlgeschlagen: " + (data.error || "Unbekannter Fehler"));
      }
    } catch (err) {
      console.error(err);
      alert("Fehler beim Löschen der Serie");
    }
  };

  if (!canAdmin) return null;

  return (
    <div className="absolute right-4 top-4 z-[3] flex flex-col gap-2">
      <button
        type="button"
        className={`btn btn--sm btn-refetch ${imagesStatus === "loading" ? "is-loading is-disabled" : ""} ${imagesStatus === "success" ? "btn--success btn-fill-success" : ""} ${imagesStatus === "error" ? "btn--danger btn-fill-danger" : ""}`}
        onClick={handleRefetchImages}
        disabled={imagesStatus === "loading"}
        aria-busy={imagesStatus === "loading"}
        onAnimationEnd={(e) => handleFillAnimationEnd(e, setImagesStatus, fallbackImagesRef)}
      >
        {imagesStatus === "loading" && (
          <span className="btn-spinner" aria-hidden />
        )}
        {imagesStatus === "idle" && "Refetch Images"}
        {(imagesStatus === "success" || imagesStatus === "error") && (
          <span className="btn-fill-label">
            {imagesStatus === "success" ? "Erfolgreich" : "Fehler"}
          </span>
        )}
      </button>
      <button
        type="button"
        className={`btn btn--sm btn-refetch ${metaStatus === "loading" ? "is-loading is-disabled" : ""} ${metaStatus === "success" ? "btn--success btn-fill-success" : ""} ${metaStatus === "error" ? "btn--danger btn-fill-danger" : ""}`}
        onClick={handleRefetchMeta}
        disabled={metaStatus === "loading"}
        aria-busy={metaStatus === "loading"}
        onAnimationEnd={(e) => handleFillAnimationEnd(e, setMetaStatus, fallbackMetaRef)}
      >
        {metaStatus === "loading" && (
          <span className="btn-spinner" aria-hidden />
        )}
        {metaStatus === "idle" && "Refetch Metadata"}
        {(metaStatus === "success" || metaStatus === "error") && (
          <span className="btn-fill-label">
            {metaStatus === "success" ? "Erfolgreich" : "Fehler"}
          </span>
        )}
      </button>
      <button
        type="button"
        className="btn btn--danger btn--sm"
        onClick={handleDelete}
      >
        Serie löschen
      </button>
    </div>
  );
}
