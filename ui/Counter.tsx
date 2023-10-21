import React from "react";
import { cx } from "twind/core";

function CounterDigit(props: { value: number; transitionDurationMs?: number | undefined }) {
  const { value, transitionDurationMs = 1500 } = props;
  const rads = -(Math.floor(value) % 1_000_000) * 2 * Math.PI * 0.1;

  return (
    <span className="w-[1em] relative">
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="absolute inset-0 grid place-items-center transition-transform duration-1000 ease-in-out [backface-visibility:hidden]"
          style={{
            transform: `rotateX(${rads + i * 2 * Math.PI * 0.1}rad)`,
            transformOrigin: `center center 2em`,
            transitionDuration: `${transitionDurationMs}ms`,
          }}
        >
          {i}
        </span>
      ))}
    </span>
  );
}

const Spacer = () => 
<span className="border-l-1 mx-[0.1em] border-zinc-200 dark:border-zinc-700" />;

const CounterText = (props: { children: React.ReactNode }) => (
  <span className="self-center px-[0.1em]">
    {props.children}
  </span>
);

export function Counter(props: {
  value: number;
  digits: number;
  fractionDigits?: number | undefined;
  transitionDurationMs?: number | undefined;
  className?: string | undefined;
  postfix?: string | undefined;
}) {
  const { value, digits, fractionDigits = 0, transitionDurationMs, className, postfix } = props;

  return (
    <span
      className={cx(
        "inline-flex h-[1.5em] items-stretch border-1 border-zinc-300 dark:border-zinc-700 shadow-inner rounded-md overflow-hidden",
        className,
      )}
    >
      {Array.from({ length: digits })
        .flatMap((_, i) => [
          i > 0 && i % 3 === 0 ? <Spacer key={`spacer${i}`} /> : null,
          <CounterDigit
            key={`digit${i}`}
            value={value / 10 ** i}
            transitionDurationMs={transitionDurationMs}
          />,
        ])
        .reverse()}

      {fractionDigits > 0 && (
        <>
          <Spacer />
          <CounterText>.</CounterText>
          <Spacer />
          {Array.from({ length: fractionDigits })
            .flatMap((_, i) => [
              i > 0 && i % 3 === 0 ? <Spacer key={`fractionSpacer${i}`} /> : null,
              <CounterDigit
                key={`fractionDigit${i}`}
                value={value * 10 ** (i + 1)}
                transitionDurationMs={transitionDurationMs}
              />,
            ])}
        </>
      )}

      {postfix && (
        <>
          <Spacer />
          <CounterText>{postfix}</CounterText>
        </>
      )}
    </span>
  );
}
