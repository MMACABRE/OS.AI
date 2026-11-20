import { useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useLift } from '../motion/motion';
import { cx } from './cx';
import styles from './NumberField.module.css';

export type NumberFieldProps = {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly label?: string;
  readonly disabled?: boolean;
  /** Shown beneath the field when set; the field is marked invalid (SET-6). */
  readonly invalidMessage?: string | null;
  /** Clamps typed text to min and max (default). False passes it on as typed, so the caller can reject it (SET-6). */
  readonly clampTyped?: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Rounds to the step's decimals, so 0.1 + 0.2 shows 0.3. */
function tidy(value: number, step: number): number {
  const decimals = (String(step).split('.')[1] ?? '').length;
  return Number(value.toFixed(decimals));
}

/**
 * A number field with a stepper. Arrow Up and Down step by `step`; Home and End go to `min` and `max`.
 * Typed text is committed on Enter or blur; text that is not a number restores the value.
 */
export function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  label,
  disabled = false,
  invalidMessage,
  clampTyped = true,
}: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = (next: number) => {
    const safe = tidy(clamp(next, min, max), step);
    setText(String(safe));
    if (safe !== value) onChange(safe);
  };
  const commitText = () => {
    const parsed = Number(text.trim());
    if (text.trim() === '' || !Number.isFinite(parsed)) setText(String(value));
    else if (clampTyped) commit(parsed);
    else if (parsed !== value) onChange(parsed);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const moves: Record<string, () => number> = {
      ArrowUp: () => value + step,
      ArrowDown: () => value - step,
      PageUp: () => value + step * 10,
      PageDown: () => value - step * 10,
      Home: () => min,
      End: () => max,
    };
    const move = moves[event.key];
    if (move !== undefined) {
      event.preventDefault();
      commit(move());
    } else if (event.key === 'Enter') commitText();
  };

  const lift = useLift();
  const invalid = invalidMessage !== undefined && invalidMessage !== null && invalidMessage !== '';
  return (
    <span className={styles.wrap}>
    <span className={styles.field}>
      <input
        type="text"
        inputMode="decimal"
        role="spinbutton"
        className={cx(styles.input, invalid && styles.invalid)}
        value={text}
        aria-label={label}
        aria-invalid={invalid}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onBlur={commitText}
        onKeyDown={onKeyDown}
      />
      <span className={styles.stepper}>
        <button
          type="button"
          className={styles.step}
          {...lift}
          tabIndex={-1}
          aria-label="Increase"
          disabled={disabled || value >= max}
          onClick={() => commit(value + step)}
        >
          ▴
        </button>
        <button
          type="button"
          className={styles.step}
          {...lift}
          tabIndex={-1}
          aria-label="Decrease"
          disabled={disabled || value <= min}
          onClick={() => commit(value - step)}
        >
          ▾
        </button>
      </span>
    </span>
    {invalid ? (
      <span className={styles.message} role="alert">
        {invalidMessage}
      </span>
    ) : null}
    </span>
  );
}
