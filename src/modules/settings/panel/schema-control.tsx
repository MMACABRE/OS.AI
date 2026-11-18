import { useState } from 'react';
import type { z } from 'zod';
import { Button, NumberField, Select, Switch, TextField } from '@hsos/ui-kit';

/** What a settings key's schema asks for (settings.md "Settings screen", control table). */
export type FieldKind =
  | { readonly kind: 'boolean' }
  | { readonly kind: 'enum'; readonly options: readonly string[] }
  | { readonly kind: 'number'; readonly min: number; readonly max: number; readonly step: number }
  | { readonly kind: 'string' }
  | { readonly kind: 'path' }
  | { readonly kind: 'json' };

type Def = {
  readonly type?: string;
  readonly innerType?: unknown;
  readonly in?: unknown;
  readonly checks?: unknown;
};

function defOf(schema: unknown): Def {
  return typeof schema === 'object' && schema !== null && 'def' in schema ? (schema.def as Def) : {};
}

/** Strips `default`, `optional`, `nullable` and `pipe` wrappers; reports whether null is allowed. */
function unwrap(schema: unknown): { inner: unknown; nullable: boolean } {
  let current = schema;
  let nullable = false;
  for (let depth = 0; depth < 8; depth += 1) {
    const def = defOf(current);
    if (def.type === 'nullable') nullable = true;
    if (
      def.type === 'default' ||
      def.type === 'optional' ||
      def.type === 'nullable' ||
      def.type === 'prefault'
    )
      current = def.innerType;
    else if (def.type === 'pipe') current = def.in;
    else break;
  }
  return { inner: current, nullable };
}

function numberOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** The control a key needs, read from its zod schema. Paths are long strings (`zAbsPath`) or keys named like paths. */
export function fieldKindOf(key: string, schema: unknown): FieldKind & { readonly nullable: boolean } {
  const { inner, nullable } = unwrap(schema);
  const type = defOf(inner).type;
  if (type === 'boolean') return { kind: 'boolean', nullable };
  if (
    type === 'enum' &&
    typeof inner === 'object' &&
    inner !== null &&
    'options' in inner &&
    Array.isArray(inner.options)
  )
    return { kind: 'enum', options: inner.options.map(String), nullable };
  if (type === 'number' && typeof inner === 'object' && inner !== null) {
    const min = numberOf(Reflect.get(inner, 'minValue')) ?? 0;
    const max = numberOf(Reflect.get(inner, 'maxValue')) ?? 1_000_000;
    const isInt = Reflect.get(inner, 'isInt') === true;
    return { kind: 'number', min, max, step: isInt ? 1 : max - min <= 2 ? 0.05 : 1, nullable };
  }
  if (type === 'string') {
    const maxLength =
      typeof inner === 'object' && inner !== null ? numberOf(Reflect.get(inner, 'maxLength')) : null;
    const looksLikePath = maxLength === 32_000 || /(path|dir|folder|file)$/i.test(key);
    return { kind: looksLikePath ? 'path' : 'string', nullable };
  }
  return { kind: 'json', nullable };
}

export type SchemaControlProps = {
  readonly settingKey: string;
  readonly label: string;
  readonly schema: z.ZodType;
  readonly value: unknown;
  /** Called with a value that passed the schema. */
  readonly onValid: (value: unknown) => void;
  /** Opens the folder picker for path keys; null when cancelled. */
  readonly pickFolder: (title: string) => Promise<string | null>;
};

/**
 * One settings key as a control. Typed input that fails the key's schema shows the schema's message
 * under the control and is not passed on (settings.md "Settings screen").
 */
export function SchemaControl({ settingKey, label, schema, value, onValid, pickFolder }: SchemaControlProps) {
  const field = fieldKindOf(settingKey, schema);
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const offer = (next: unknown, text: string | null) => {
    const checked = schema.safeParse(next);
    if (checked.success) {
      setMessage(null);
      setDraft(null);
      onValid(checked.data);
    } else {
      setDraft(text);
      setMessage(checked.error.issues[0]?.message ?? 'This value is not allowed.');
    }
  };

  if (field.kind === 'boolean')
    return <Switch checked={value === true} label={label} hideLabel onChange={(next) => offer(next, null)} />;
  if (field.kind === 'enum')
    return (
      <Select
        value={typeof value === 'string' ? value : (field.options[0] ?? '')}
        label={label}
        options={field.options.map((option) => ({ value: option, label: option }))}
        onChange={(next) => offer(next, null)}
      />
    );
  if (field.kind === 'number')
    return (
      <NumberField
        value={typeof value === 'number' ? value : field.min}
        min={field.min}
        max={field.max}
        step={field.step}
        label={label}
        onChange={(next) => offer(next, null)}
      />
    );

  const shown =
    draft ?? (field.kind === 'json' ? JSON.stringify(value ?? null) : typeof value === 'string' ? value : '');
  const fromText = (text: string): unknown => {
    if (field.kind === 'json') {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return Symbol('invalid');
      }
    }
    return field.nullable && text.trim() === '' ? null : text;
  };
  return (
    <span style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'flex-start' }}>
      <TextField
        value={shown}
        label={label}
        mono={field.kind !== 'string'}
        invalidMessage={message}
        onChange={(text) => offer(fromText(text), text)}
      />
      {field.kind === 'path' ? (
        <Button
          size="small"
          onPress={() =>
            void pickFolder(`Choose ${label.toLowerCase()}`).then((picked) => {
              if (picked !== null) offer(picked, null);
            })
          }
        >
          Browse
        </Button>
      ) : null}
    </span>
  );
}
