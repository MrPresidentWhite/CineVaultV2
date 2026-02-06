"use client";

type Props = {
  seriesId: number;
  canAdmin: boolean;
};

export function SeriesHeroActions({ seriesId, canAdmin }: Props) {

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
    <div className="absolute right-4 top-4 z-[3]">
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
