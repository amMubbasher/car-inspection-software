"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function toKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplay(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function daysInMonth(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return { leading: first.getDay(), count };
}

function MonthGrid({
  month,
  start,
  end,
  today,
  onPick,
}: {
  month: Date;
  start: string;
  end: string;
  today: string;
  onPick: (value: string) => void;
}) {
  const { leading, count } = daysInMonth(month);
  const cells = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: count }, (_, index) => index + 1),
  ];

  return (
    <div className="w-[252px]">
      <p className="mb-2 text-center text-sm font-semibold text-gray-900 dark:text-white">
        {monthLabel(month)}
      </p>
      <div className="grid grid-cols-7 gap-y-1 text-center text-xs text-gray-400">
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-1">
            {day}
          </span>
        ))}
        {cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;
          const value = toKey(new Date(month.getFullYear(), month.getMonth(), day));
          const selected = value === start || value === end;
          const inRange = Boolean(start && end && value > start && value < end);
          const isToday = value === today;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onPick(value)}
              className={cn(
                "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800",
                isToday && !selected && "ring-1 ring-indigo-400",
                inRange && "rounded-none bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-200",
                selected && "bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:text-white"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangeField({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => addMonths(parseDate(start), 0));
  const [draftStart, setDraftStart] = useState(start);
  const [draftEnd, setDraftEnd] = useState(end);
  const draftRef = useRef({ start, end });
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const todayKey = toKey(new Date());

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(560, window.innerWidth - 16);
      let left = rect.left;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
      if (left < 8) left = 8;
      const panelHeight = panelRef.current?.offsetHeight ?? 360;
      let top = rect.bottom + 8;
      if (top + panelHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - panelHeight - 8);
      }
      setPosition({ top, left });
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
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
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

  const openPicker = () => {
    const startDate = parseDate(start);
    setViewMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
    draftRef.current = { start, end };
    setDraftStart(start);
    setDraftEnd(end);
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(560, window.innerWidth - 16);
      let left = rect.left;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
      setPosition({ top: rect.bottom + 8, left: Math.max(8, left) });
    }
    setOpen(true);
  };

  const applyRange = (from: string, to: string) => {
    const startValue = from <= to ? from : to;
    const endValue = from <= to ? to : from;
    draftRef.current = { start: startValue, end: endValue };
    setDraftStart(startValue);
    setDraftEnd(endValue);
    onChange(startValue, endValue);
    setOpen(false);
  };

  const pickDay = (value: string) => {
    const { start: currentStart, end: currentEnd } = draftRef.current;
    if (!currentStart || currentEnd) {
      draftRef.current = { start: value, end: "" };
      setDraftStart(value);
      setDraftEnd("");
      return;
    }
    if (value < currentStart) {
      draftRef.current = { start: value, end: "" };
      setDraftStart(value);
      setDraftEnd("");
      return;
    }
    applyRange(currentStart, value);
  };

  const selectToday = () => {
    const month = new Date();
    setViewMonth(new Date(month.getFullYear(), month.getMonth(), 1));
    applyRange(todayKey, todayKey);
  };

  const panelWidth = typeof window === "undefined" ? 560 : Math.min(560, window.innerWidth - 16);

  return (
    <>
      <button
        ref={buttonRef}
        id={labelId}
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-white px-3 text-left text-sm text-gray-900 lg:w-[250px] dark:bg-gray-900 dark:text-white"
      >
        <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="truncate">
          {formatDisplay(start)} – {formatDisplay(end)}
        </span>
      </button>
      {mounted && open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Choose date range"
            style={{ top: position.top, left: position.left, width: panelWidth }}
            className="fixed z-50 max-h-[80vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewMonth((month) => addMonths(month, -1))}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex flex-col items-center gap-1">
                <p className="text-xs text-gray-500">Select a start date, then an end date</p>
                <button
                  type="button"
                  onClick={selectToday}
                  className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  Today
                </button>
              </div>
              <button
                type="button"
                onClick={() => setViewMonth((month) => addMonths(month, 1))}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:items-start">
              <MonthGrid month={viewMonth} start={draftStart} end={draftEnd} today={todayKey} onPick={pickDay} />
              <MonthGrid month={addMonths(viewMonth, 1)} start={draftStart} end={draftEnd} today={todayKey} onPick={pickDay} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
