"use client";

import { useRouter } from "next/navigation";

type Props = {
  movieId: number;
  canEdit: boolean;
  canAdmin: boolean;
  placement: "top" | "meta";
};

export function MovieHeroActions({
  movieId,
  canEdit,
  canAdmin,
  placement,
}: Props) {
  const router = useRouter();

  const handleRefetchImages = async () => {
    try {
      const res = await fetch(`/api/movies/${movieId}/refetch-images`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Refetch fehlgeschlagen.");
    }
  };

  const handleRefetchMeta = async () => {
    try {
      const res = await fetch(`/api/movies/${movieId}/refetch-meta`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Refetch fehlgeschlagen.");
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Film wirklich löschen? Alle zugehörigen Dateien werden ebenfalls gelöscht! Dies kann nicht rückgängig gemacht werden."
      )
    )
      return;
    try {
      const res = await fetch(`/api/movies/${movieId}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.ok) {
        alert("Film erfolgreich gelöscht");
        window.location.href = "/movies";
      } else {
        alert("Löschen fehlgeschlagen: " + (data.error || "Unbekannter Fehler"));
      }
    } catch (err) {
      console.error(err);
      alert("Fehler beim Löschen des Films");
    }
  };

  const openEditModal = () => {
    const modal = document.getElementById("editModal");
    if (modal) {
      (modal as HTMLDivElement).hidden = false;
      modal.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("modal-open");
      document.body.classList.add("modal-open");
    }
  };

  if (placement === "top") {
    return (
      <div className="absolute right-4 top-4 z-[3] flex flex-col gap-2">
        {canEdit && (
          <>
            <button
              type="button"
              className="btn btn--sm"
              onClick={handleRefetchImages}
            >
              Refetch Images
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={handleRefetchMeta}
            >
              Refetch Metadata
            </button>
          </>
        )}
        {canAdmin && (
          <button
            type="button"
            className="btn btn--danger btn--sm"
            onClick={handleDelete}
          >
            Delete Movie
          </button>
        )}
      </div>
    );
  }

  if (placement === "meta" && canEdit) {
    return (
      <button
        type="button"
        id="editOpen"
        className="btn btn--primary mt-1.5"
        aria-controls="editModal"
        aria-haspopup="dialog"
        onClick={openEditModal}
      >
        Bearbeiten
      </button>
    );
  }

  return null;
}
