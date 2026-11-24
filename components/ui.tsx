"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** Each step's heading takes focus on arrival so keyboard and screen-reader users land on the new content. */
export function Heading({ children, className = "title", level = 1 }: { children: ReactNode; className?: string; level?: 1 | 2 }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: false });
  }, []);
  const Tag = level === 1 ? "h1" : "h2";
  return (
    <Tag ref={ref} tabIndex={-1} className={className}>
      {children}
    </Tag>
  );
}

export function YesNo({
  legend,
  hint,
  value,
  onChange,
  yesLabel = "Yes",
  noLabel = "No",
  className = "",
}: {
  legend: ReactNode;
  hint?: ReactNode;
  value: boolean | null | undefined;
  onChange: (value: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={`question ${className}`}>
      <legend>{legend}</legend>
      {hint ? <p className="hint">{hint}</p> : null}
      <div className="yesno">
        <label className="choice">
          <input type="radio" name={name} checked={value === true} onChange={() => onChange(true)} />
          <span>{yesLabel}</span>
        </label>
        <label className="choice">
          <input type="radio" name={name} checked={value === false} onChange={() => onChange(false)} />
          <span>{noLabel}</span>
        </label>
      </div>
    </fieldset>
  );
}

export function ScreenHead({ onBack, step }: { onBack?: () => void; step?: string }) {
  return (
    <div className="screen-head">
      {onBack ? (
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
          <ArrowLeft />
        </button>
      ) : null}
      {step ? <span className="step-count">{step}</span> : null}
    </div>
  );
}

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const ArrowLeft = () => (
  <svg {...iconProps}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const ArrowRight = () => (
  <svg {...iconProps}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const Close = () => (
  <svg {...iconProps}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const Check = () => (
  <svg {...iconProps} width={30} height={30} strokeWidth={2.2}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const Keyboard = () => (
  <svg {...iconProps}>
    <rect x="3" y="6" width="18" height="12" rx="2.5" />
    <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
  </svg>
);

export const Mic = () => (
  <svg {...iconProps}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" />
  </svg>
);

export const Play = () => (
  <svg {...iconProps}>
    <path d="M8 5.5v13l10.5-6.5z" />
  </svg>
);

export const Stop = () => (
  <svg {...iconProps}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" />
  </svg>
);

export const Stethoscope = () => (
  <svg {...iconProps}>
    <path d="M6 3v5a4 4 0 008 0V3M10 12v3a5 5 0 0010 0v-1" />
    <circle cx="20" cy="12" r="2" />
  </svg>
);

export const Phone = () => (
  <svg {...iconProps}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
  </svg>
);
