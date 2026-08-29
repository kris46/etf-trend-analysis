import type { StrategyCondition } from "../../types/market";
import { FIELD_REGISTRY, FIELD_BY_KEY } from "../../lib/backtest/fields";

const OPERATORS_BY_TYPE: Record<string, { value: StrategyCondition["operator"]; label: string }[]> = {
  enum: [
    { value: "equals", label: "is" },
    { value: "notEquals", label: "is not" },
  ],
  number: [
    { value: "greaterThan", label: ">" },
    { value: "lessThan", label: "<" },
  ],
  boolean: [
    { value: "isTrue", label: "is true" },
    { value: "isFalse", label: "is false" },
  ],
};

export function ConditionRow({
  condition,
  onChange,
  onDelete,
}: {
  condition: StrategyCondition;
  onChange: (next: StrategyCondition) => void;
  onDelete: () => void;
}) {
  const field = FIELD_BY_KEY[condition.field] ?? FIELD_REGISTRY[0];

  function setField(key: string) {
    const newField = FIELD_BY_KEY[key];
    const operators = OPERATORS_BY_TYPE[newField.type];
    onChange({ ...condition, field: key, operator: operators[0].value, value: newField.type === "boolean" ? true : newField.options?.[0] ?? 0 });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-sm border border-line bg-surface-raised p-2">
      <select value={field.key} onChange={(e) => setField(e.target.value)} className="rounded-sm border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus-visible:border-signal">
        {FIELD_REGISTRY.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value as StrategyCondition["operator"] })}
        className="rounded-sm border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus-visible:border-signal"
      >
        {OPERATORS_BY_TYPE[field.type].map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {field.type === "enum" && (
        <select
          value={String(condition.value)}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          className="rounded-sm border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus-visible:border-signal"
        >
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {field.type === "number" && (
        <input
          type="number"
          value={Number(condition.value)}
          onChange={(e) => onChange({ ...condition, value: Number(e.target.value) })}
          className="num w-20 rounded-sm border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus-visible:border-signal"
        />
      )}

      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
        weight
        <input
          type="number"
          min={0}
          max={100}
          value={condition.weight}
          onChange={(e) => onChange({ ...condition, weight: Number(e.target.value) })}
          className="num w-14 rounded-sm border border-line bg-surface px-1.5 py-1 text-xs text-ink outline-none focus-visible:border-signal"
        />
      </label>

      <button onClick={onDelete} className="ml-auto text-xs text-ink-muted hover:text-bear">
        ✕
      </button>
    </div>
  );
}
