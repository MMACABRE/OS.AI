import styles from './Select.module.css';

export type SelectOption<T extends string> = { readonly value: T; readonly label: string };

export type SelectProps<T extends string> = {
  readonly value: T;
  readonly options: readonly SelectOption<T>[];
  readonly onChange: (value: T) => void;
  readonly label?: string;
  readonly disabled?: boolean;
};

/**
 * A choice from a short list. The spec names Radix select, which is not a dependency of this build;
 * the native select gives the same keyboard behaviour (UI-2) and is styled to the theme.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
}: SelectProps<T>) {
  return (
    <span className={styles.wrap}>
      <select
        className={styles.select}
        value={value}
        aria-label={label}
        disabled={disabled}
        onChange={(event) => {
          const next = options.find((option) => option.value === event.target.value);
          if (next !== undefined) onChange(next.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className={styles.chevron} aria-hidden="true">
        ▾
      </span>
    </span>
  );
}
