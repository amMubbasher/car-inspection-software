"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
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
  className,
}: {
  month: Date;
  start: string;
  end: string;
  today: string;
  onPick: (value: string) => void;
  className?: string;
}) {
  const { leading, count } = daysInMonth(month);
  const cells = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: count }, (_, index) => index + 1),
  ];

  return (
    <div className={cn("w-full max-w-[240px]", className)}>
      <p className="mb-1.5 text-center text-xs font-semibold text-gray-900 sm:text-sm dark:text-white">
        {monthLabel(month)}
      </p>
      <div className="grid grid-cols-7 text-center text-[11px] text-gray-400">
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-0.5">
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
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onPick(value);
              }}
              className={cn(
                "mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs text-gray-800 hover:bg-gray-100 sm:h-8 sm:w-8 dark:text-gray-100 dark:hover:bg-gray-800",
                isToday && !selected && "ring-1 ring-indigo-400",
                inRange &&
                  "rounded-none bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-200",
                selected &&
                  "bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:text-white"
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

function CalendarPanel({
  viewMonth,
  setViewMonth,
  draftStart,
  draftEnd,
  todayKey,
  onPick,
  onSelectToday,
  panelRef,
  style,
  className,
}: {
  viewMonth: Date;
  setViewMonth: Dispatch<SetStateAction<Date>>;
  draftStart: string;
  draftEnd: string;
  todayKey: string;
  onPick: (value: string) => void;
  onSelectToday: () => void;
  panelRef?: RefObject<HTMLDivElement | null>;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      ref={panelRef}
      data-date-range-panel=""
      style={style}
      className={className}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setViewMonth((month) => addMonths(month, -1))}
          className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 flex-col items-center gap-1">
          <p className="text-center text-[11px] leading-tight text-gray-500 sm:text-xs">
            {draftStart && !draftEnd
              ? "Select an end date"
              : "Start date, then end date"}
          </p>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onSelectToday}
            className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-medium text-white hover:bg-indigo-500"
          >
            Today
          </button>
        </div>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setViewMonth((month) => addMonths(month, 1))}
          className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:items-start sm:gap-3">
        <MonthGrid
          month={viewMonth}
          start={draftStart}
          end={draftEnd}
          today={todayKey}
          onPick={onPick}
        />
        <MonthGrid
          className="hidden sm:block"
          month={addMonths(viewMonth, 1)}
          start={draftStart}
          end={draftEnd}
          today={todayKey}
          onPick={onPick}
        />
      </div>
    </div>
  );
}

export function DateRangeField({
  start,
  end,
  onChange,
  embedded = false,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  /** Always show the two-month calendar (for use inside dialogs). */
  embedded?: boolean;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const ignoreOutsideRef = useRef(false);
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => addMonths(parseDate(start), 0));
  const [draftStart, setDraftStart] = useState(start);
  const [draftEnd, setDraftEnd] = useState(end);
  const selectingRef = useRef(false);
  const draftRef = useRef({ start, end });
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const todayKey = toKey(new Date());

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!embedded || selectingRef.current) return;
    draftRef.current = { start, end };
    setDraftStart(start);
    setDraftEnd(end);
    const startDate = parseDate(start);
    setViewMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
  }, [embedded, start, end]);

  useEffect(() => {
    if (!open || embedded) return;

    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const isNarrow = window.innerWidth < 640;
      const width = Math.min(isNarrow ? 280 : 520, window.innerWidth - 16);
      let left = isNarrow ? (window.innerWidth - width) / 2 : rect.left;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
      if (left < 8) left = 8;
      const panelHeight = panelRef.current?.offsetHeight ?? 320;
      let top = rect.bottom + 8;
      if (top + panelHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - panelHeight - 8);
      }
      setPosition({ top, left });
    };

    place();
    const frame = window.requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, embedded]);

  useEffect(() => {
    if (!open || embedded) return;

    const onOutside = (event: Event) => {
      if (ignoreOutsideRef.current) return;
      const target = event.target as Element | null;
      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target) ||
        target?.closest?.("[data-date-range-panel]")
      ) {
        return;
      }
      setOpen(false);
      selectingRef.current = false;
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        selectingRef.current = false;
      }
    };

    // Attach after the opening click finishes so that same click cannot close it.
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onOutside);
      document.addEventListener("keydown", onKey);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, embedded]);

  const openPicker = () => {
    ignoreOutsideRef.current = true;
    const startDate = parseDate(start);
    setViewMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
    draftRef.current = { start, end };
    setDraftStart(start);
    setDraftEnd(end);
    selectingRef.current = false;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const isNarrow = window.innerWidth < 640;
      const width = Math.min(isNarrow ? 280 : 520, window.innerWidth - 16);
      let left = isNarrow ? (window.innerWidth - width) / 2 : rect.left;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
      setPosition({ top: rect.bottom + 8, left: Math.max(8, left) });
    }
    setOpen(true);
    window.setTimeout(() => {
      ignoreOutsideRef.current = false;
    }, 50);
  };

  const applyRange = (from: string, to: string) => {
    const startValue = from <= to ? from : to;
    const endValue = from <= to ? to : from;
    draftRef.current = { start: startValue, end: endValue };
    setDraftStart(startValue);
    setDraftEnd(endValue);
    selectingRef.current = false;
    onChange(startValue, endValue);
    if (!embedded) setOpen(false);
  };

  const pickDay = (value: string) => {
    if (!selectingRef.current) {
      selectingRef.current = true;
      draftRef.current = { start: value, end: "" };
      setDraftStart(value);
      setDraftEnd("");
      return;
    }

    const { start: currentStart } = draftRef.current;
    if (!currentStart) {
      selectingRef.current = true;
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

  const panelWidth =
    typeof window === "undefined"
      ? 280
      : Math.min(window.innerWidth < 640 ? 280 : 520, window.innerWidth - 16);

  if (embedded) {
    return (
      <div className="w-full">
        <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
          {formatDisplay(draftStart || start)} –{" "}
          {draftEnd ? formatDisplay(draftEnd) : draftStart ? "…" : formatDisplay(end)}
        </p>
        <CalendarPanel
          viewMonth={viewMonth}
          setViewMonth={setViewMonth}
          draftStart={draftStart}
          draftEnd={draftEnd}
          todayKey={todayKey}
          onPick={pickDay}
          onSelectToday={selectToday}
          className="mx-auto w-full max-w-[280px] rounded-xl border border-gray-200 bg-white p-3 sm:max-w-[520px] dark:border-gray-700 dark:bg-gray-900"
        />
      </div>
    );
  }

  return (
    <div className="relative w-full lg:w-auto">
      <button
        ref={buttonRef}
        id={labelId}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onMouseDown={(event) => {
          // Keep the opening click from being treated as an outside click.
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (open) {
            setOpen(false);
            selectingRef.current = false;
          } else {
            openPicker();
          }
        }}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-white px-3 text-left text-sm text-gray-900 lg:w-[250px] dark:bg-gray-900 dark:text-white"
      >
        <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="truncate">
          {formatDisplay(start)} – {formatDisplay(end)}
        </span>
      </button>
      {mounted &&
        open &&
        createPortal(
          <CalendarPanel
            panelRef={panelRef}
            viewMonth={viewMonth}
            setViewMonth={setViewMonth}
            draftStart={draftStart}
            draftEnd={draftEnd}
            todayKey={todayKey}
            onPick={pickDay}
            onSelectToday={selectToday}
            style={{ top: position.top, left: position.left, width: panelWidth }}
            className="fixed z-[80] max-h-[min(70vh,420px)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900"
          />,
          document.body
        )}
    </div>
  );
}
