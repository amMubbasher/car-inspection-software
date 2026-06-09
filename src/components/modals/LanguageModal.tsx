"use client";

import { POPULAR_LANGUAGES } from "@/lib/popularLanguages";
import { cn } from "@/lib/utils";

type LanguageModalProps = {
  isOpen: boolean;
  selectedCountryCode: string;
  onSelect: (countryCode: string) => void;
  onClose: () => void;
};

export function LanguageModal({
  isOpen,
  selectedCountryCode,
  onSelect,
  onClose,
}: LanguageModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="notranslate absolute right-0 top-full mt-2 w-52 rounded-lg border bg-popover shadow-lg z-50 overflow-hidden"
      translate="no"
    >
      <div className="px-3 py-2 border-b text-xs font-medium text-muted-foreground">
        Select Language
      </div>
      <ul className="max-h-72 overflow-y-auto py-1">
        {POPULAR_LANGUAGES.map((lang) => (
          <li key={lang.countryCode}>
            <button
              type="button"
              onClick={() => {
                onSelect(lang.countryCode);
                onClose();
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                selectedCountryCode === lang.countryCode && "bg-accent/60 font-medium"
              )}
            >
              <span className="text-lg leading-none">{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
