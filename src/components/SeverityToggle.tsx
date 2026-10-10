import type { Severity } from "@/types/job";

const OPTIONS: { value: Severity; label: string; active: string }[] = [
  { value: "ok", label: "OK", active: "bg-emerald-600 text-white" },
  { value: "minor", label: "Minor", active: "bg-amber-500 text-white" },
  { value: "major", label: "Major", active: "bg-red-600 text-white" },
];

export function SeverityToggle({
  value,
  onChange,
}: {
  value: Severity;
  onChange: (value: Severity) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Severity"
      className="inline-flex shrink-0 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800"
    >
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              selected
                ? option.active
                : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
