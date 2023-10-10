import { cx } from "@twind/core";
import React from "react";

function CounterDigit(props: { value: number; transitionDurationMs?: number }) {
  const { value, transitionDurationMs = 1000 } = props;
  const rads = -(Math.floor(value) % 1_000_000) * 2 * Math.PI * 0.1;

  return (
    <span className="w-[1em] h-[1.3em] relative">
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="absolute inset-0 grid place-items-center transition-transform duration-1000 ease-in-out [backface-visibility:hidden]"
          style={{
            transform: `rotateX(${rads + i * 2 * Math.PI * 0.1}rad)`,
            transformOrigin: `center center 1.8em`,
            transitionDuration: `${transitionDurationMs}ms`,
          }}
        >
          {i}
        </span>
      ))}
    </span>
  );
}

export function Counter(props: {
  value: number;
  digits: number;
  transitionDurationMs?: number;
  className?: string;
}) {
  const { value, digits, transitionDurationMs, className } = props;

  return (
    <span
      className={cx(
        "inline-flex items-stretch border-1 border-zinc-300 dark:border-zinc-700 shadow-inner rounded-md overflow-hidden",
        className,
      )}
    >
      {Array.from({ length: digits })
        .flatMap((_, i) => [
          i > 0 && i % 3 === 0
            ? (
              <span
                key={`spacer${i}`}
                className="border-l-1 mx-[0.1em] border-zinc-200 dark:border-zinc-700"
              />
            )
            : null,
          <CounterDigit
            key={`digit${i}`}
            value={value / 10 ** i}
            transitionDurationMs={transitionDurationMs}
          />,
        ])
        .reverse()}
    </span>
  );
}
