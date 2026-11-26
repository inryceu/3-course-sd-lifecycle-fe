import { useState } from 'react';

interface ConfirmButtonProps {
  label: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
  /** Accessible name of the first button and of its confirm step (e.g. "Remove bob"). */
  ariaLabel?: string;
  title?: string;
}

/** Two-step destructive button: the first click asks, the second one acts (no browser dialog). */
export function ConfirmButton({
  label,
  onConfirm,
  className = 'btn-danger text-sm',
  disabled,
  ariaLabel,
  title,
}: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        className={className}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        onClick={() => setAsking(true)}
      >
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex gap-1">
      <button
        type="button"
        className="btn-danger text-sm"
        aria-label={ariaLabel && `Confirm ${ariaLabel.toLowerCase()}`}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        Confirm {label.toLowerCase()}
      </button>
      <button type="button" className="btn-secondary text-sm" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}
