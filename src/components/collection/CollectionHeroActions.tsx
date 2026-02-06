"use client";

import { useRouter } from "next/navigation";

type Props = {
  collectionId: number;
  canEdit: boolean;
};

export function CollectionHeroActions({
  collectionId,
  canEdit,
}: Props) {
  const router = useRouter();

  const handleRefetchImages = async () => {
    try {
      const res = await fetch(
        `/api/collections/${collectionId}/refetch-images`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Refetch fehlgeschlagen.");
    }
  };

  const handleRefetchMeta = async () => {
    try {
      const res = await fetch(
        `/api/collections/${collectionId}/refetch-meta`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Refetch fehlgeschlagen.");
    }
  };

  if (!canEdit) return null;

  return (
    <div className="absolute right-4 top-4 z-[3] flex flex-col gap-2">
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
    </div>
  );
}
