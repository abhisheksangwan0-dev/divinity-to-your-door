import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-transform duration-150 ease-out active:not-disabled:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40";

export function buttonClass(
  variant: "solid" | "ghost" | "ink" = "solid",
  className?: string,
) {
  return cn(
    base,
    variant === "solid" && "bg-vermilion text-paper hover:bg-vermilion-deep",
    variant === "ink" && "bg-ink text-paper",
    variant === "ghost" && "border border-line bg-transparent text-ink hover:border-ink",
    className,
  );
}

export function Button({
  variant = "solid",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: "solid" | "ghost" | "ink" }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}
