"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type SkeletonImageProps = ImageProps & {
  /**
   * Additional classes for the skeleton layer (e.g. different color/radius).
   */
  skeletonClassName?: string;
  /**
   * Classes for the surrounding container (e.g. fixed height/width).
   */
  containerClassName?: string;
};

function mergeClasses(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Wrapper around `next/image` with simple Tailwind skeleton:
 * - shows pulsating placeholder until image is loaded
 * - preserves size/aspect-ratio set by calling code
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
        alt={imageProps.alt ?? ""}
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

