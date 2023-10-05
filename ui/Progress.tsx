import { cx } from "@twind/core";
import React from "react";

export function Progress(props: { value: number; className?: string }) {
  const { value, className } = props;

  return (
    <div
      className={cx(
        "flex items-stretch overflow-hidden rounded-md bg-zinc-200 text-xs text-white dark:bg-zinc-800",
        className,
      )}
    >
      <div
        className="bg-stripes flex items-center justify-center overflow-hidden rounded-md bg-sky-500 transition-[flex-grow] duration-1000"
        style={{ flexGrow: value }}
      >
        {(value * 100).toFixed(0)}%
      </div>
      <div
        className="flex items-center justify-center overflow-hidden transition-[flex-grow] duration-500"
        style={{ flexGrow: 1 - value }}
      >
      </div>
    </div>
  );
}
