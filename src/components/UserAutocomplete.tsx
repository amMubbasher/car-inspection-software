"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserOption } from "@/lib/serializeUser";

function userLabel(user: Pick<UserOption, "name" | "email">) {
  return user.name?.trim() || user.email;
}

export function UserAutocomplete({
  users,
  value,
  onChange,
}: {
  users: UserOption[];
  value: string;
  onChange: (userId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 220 });

  const selected = users.find((user) => user._id === value);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) setQuery(selected ? userLabel(selected) : "");
  }, [open, selected]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(rect.width, 220);
      let left = rect.left;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
      setPosition({ top: rect.bottom + 4, left: Math.max(8, left), width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (inputRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || (selected && q === userLabel(selected).toLowerCase())) return users;
    return users.filter((user) => {
      const name = (user.name || "").toLowerCase();
      return name.includes(q) || user.email.toLowerCase().includes(q);
    });
  }, [query, selected, users]);

  const choose = (userId: string) => {
    onChange(userId);
    const user = users.find((item) => item._id === userId);
    setQuery(user ? userLabel(user) : "");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <>
      <div className="relative w-full lg:w-[220px]">
        <UserPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          placeholder="All Inspectors"
          value={query}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && open) {
              event.preventDefault();
              if (matches[0] && query.trim() && query.trim().toLowerCase() !== (selected ? userLabel(selected).toLowerCase() : "")) {
                choose(matches[0]._id);
              }
            }
          }}
          className="notranslate h-9 w-full rounded-md border border-input bg-white pl-9 pr-3 text-sm text-gray-900 dark:bg-gray-900 dark:text-white"
          translate="no"
        />
      </div>
      {mounted && open &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            style={{ top: position.top, left: position.left, width: position.width }}
            className="fixed z-50 max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            <button
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800",
                !value && "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200"
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose("")}
            >
              All Inspectors
            </button>
            {matches.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500">No inspectors found</p>
            ) : (
              matches.map((user) => (
                <button
                  key={user._id}
                  type="button"
                  role="option"
                  aria-selected={user._id === value}
                  className={cn(
                    "flex w-full flex-col px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800",
                    user._id === value && "bg-indigo-50 dark:bg-indigo-500/10"
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(user._id)}
                >
                  <span className="notranslate truncate text-sm font-medium text-gray-900 dark:text-white" translate="no">
                    {userLabel(user)}
                  </span>
                  {user.name?.trim() && (
                    <span className="notranslate truncate text-xs text-gray-500" translate="no">
                      {user.email}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>,
          document.body
        )}
    </>
  );
}
