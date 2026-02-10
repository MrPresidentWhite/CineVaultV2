"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type SkeletonImageProps = ImageProps & {
  /**
   * Zusätzliche Klassen für den Skeleton-Layer (z. B. andere Farbe/Rundung).
   */
  skeletonClassName?: string;
  /**
   * Klassen für den umgebenden Container (z. B. feste Höhe/Breite).
   */
  containerClassName?: string;
};

function mergeClasses(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Wrapper um `next/image` mit einfachem Tailwind-Skeleton:
 * - zeigt einen pulsierenden Platzhalter, bis das Bild geladen ist
 * - behält die vom aufrufenden Code gesetzte Größe/Aspect-Ratio bei
 */
export function SkeletonImage({
  className,
  skeletonClassName,
  containerClassName,
  onLoad,
  ...imageProps
}: SkeletonImageProps) {
  const [loaded, setLoaded] = useState(false);

  const isFill = Boolean(imageProps.fill);
  const containerBase = isFill && containerClassName
    ? "overflow-hidden"
    : "relative overflow-hidden";

  return (
    <div className={mergeClasses(containerBase, containerClassName)}>
      {!loaded && (
        <div
          className={mergeClasses(
            "absolute inset-0 animate-pulse bg-neutral-800",
            skeletonClassName
          )}
        />
      )}
      <Image
        {...imageProps}
        className={mergeClasses(
          className ?? "",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={(event) => {
          setLoaded(true);
          onLoad?.(event);
        }}
      />
    </div>
  );
}

