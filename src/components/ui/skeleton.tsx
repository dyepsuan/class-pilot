import type { HTMLAttributes } from "react";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({
  className = "",
  ...props
}: SkeletonProps) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={`rounded-md bg-gray-200/80 motion-safe:animate-pulse ${className}`}
    />
  );
}
