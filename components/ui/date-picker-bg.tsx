"use client";

import * as React from "react";
import { format, isValid, parseISO } from "date-fns";
import { bg } from "date-fns/locale";
import { CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerBGProps {
  value?: string;
  onChange: (value: string) => void;

  placeholder?: string;

  disabled?: boolean;

  className?: string;

  minDate?: string;
  maxDate?: string;

  clearable?: boolean;
}

function isoToDate(value?: string) {
  if (!value) return undefined;

  const date = parseISO(value);

  return isValid(date)
    ? date
    : undefined;
}

function dateToIso(date: Date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function DatePickerBG({
  value,
  onChange,

  placeholder = "ДД/ММ/ГГГГ",

  disabled = false,

  className,

  minDate,
  maxDate,

  clearable = true,
}: DatePickerBGProps) {
  const [open, setOpen] =
    React.useState(false);

  const selectedDate =
    isoToDate(value);

  const min =
    isoToDate(minDate);

  const max =
    isoToDate(maxDate);

  function isDisabled(date: Date) {
    const compareDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );

    if (min) {
      const minCompare = new Date(
        min.getFullYear(),
        min.getMonth(),
        min.getDate(),
      );

      if (
        compareDate < minCompare
      ) {
        return true;
      }
    }

    if (max) {
      const maxCompare = new Date(
        max.getFullYear(),
        max.getMonth(),
        max.getDate(),
      );

      if (
        compareDate > maxCompare
      ) {
        return true;
      }
    }

    return false;
  }

  function handleSelect(
    date: Date | undefined,
  ) {
    if (!date) return;

    onChange(dateToIso(date));

    setOpen(false);
  }

  function setToday() {
    const today = new Date();

    if (isDisabled(today)) {
      return;
    }

    onChange(dateToIso(today));

    setOpen(false);
  }

  function clearDate() {
    onChange("");

    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-start gap-2.5 rounded-xl px-3",
            "border-input/80 bg-background text-left text-sm font-normal",
            "shadow-[0_1px_2px_rgb(0_0_0/0.03)]",
            "transition-[border-color,box-shadow,background-color] duration-150",
            "hover:border-foreground/20 hover:bg-background",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/15",
            !selectedDate &&
              "text-muted-foreground",
            className,
          )}
        >
          <CalendarDays className="size-3.5 shrink-0 text-muted-foreground/80" />

          <span className="min-w-0 flex-1 truncate">
            {selectedDate
              ? format(
                  selectedDate,
                  "dd/MM/yyyy",
                  {
                    locale: bg,
                  },
                )
              : placeholder}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
  align="start"
  sideOffset={8}
  collisionPadding={16}
  className={cn(
    "z-[99999]",
    "w-auto min-w-[320px]",
    "overflow-hidden",
    "rounded-2xl",
    "border border-slate-200",
    "bg-white",
    "p-0",
    "text-slate-950",
    "shadow-[0_20px_60px_rgba(0,0,0,0.18)]",
    "opacity-100",
    "backdrop-blur-none"
  )}
>
        {/* HEADER */}

        <div className="px-4 pb-1 pt-3.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Избери дата
          </p>

          <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
            {selectedDate
              ? format(
                  selectedDate,
                  "dd MMMM yyyy",
                  {
                    locale: bg,
                  },
                )
              : "Изберете ден от календара"}
          </p>
        </div>

        {/* CALENDAR */}

        <div className="px-3 pb-3 pt-1.5">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={handleSelect}
            disabled={isDisabled}
            locale={bg}
            weekStartsOn={1}
            showOutsideDays
            formatters={{
              formatWeekdayName: (date) => format(date, "EEEEEE", { locale: bg }),
            }}
            className="w-full bg-transparent p-0 [--cell-size:2rem]"
            classNames={{
              months:
                "w-full",

              month:
                "w-full space-y-2.5",

              month_caption:
                "relative flex h-8 items-center justify-center px-9",

              caption_label:
                "select-none text-sm font-semibold capitalize tracking-[-0.01em] text-foreground",

              nav:
                "absolute inset-x-0 top-0 flex h-8 items-center justify-between",

              button_previous:
                "inline-flex size-7 items-eeeeeeeeeeeeeeeeeeeeeeee justify-center rounded-lg border border-transparent bg-transparent p-0 text-muted-foreground transition-colors hover:border-border/60 hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/20",

              button_next:
                "inline-flex size-7 items-center justify-center rounded-lg border border-transparent bg-transparent p-0 text-muted-foreground transition-colors hover:border-border/60 hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/20",

              month_grid:
                "w-full border-separate border-spacing-0",

              weekdays:
                "grid grid-cols-7",

              weekday:
                "flex h-7 items-center justify-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70",

              week:
                "mt-0.5 grid grid-cols-7",

              day:
                "group/day relative flex h-9 items-center justify-center p-0 text-center",

              day_button:
                "mx-auto size-8 min-w-8 rounded-lg text-[13px] font-normal text-foreground transition-[background-color,color,box-shadow] duration-150 hover:bg-muted/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/20 data-[selected-single=true]:bg-primary data-[selected-single=true]:font-medium data-[selected-single=true]:text-primary-foreground data-[selected-single=true]:shadow-[0_2px_8px_-3px_rgb(0_0_0/0.35)]",

              today:
                "rounded-lg bg-primary/[0.08] text-primary [&>button]:font-semibold",

              selected:
                "rounded-lg bg-primary text-primary-foreground shadow-sm [&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary/90",

              outside:
                "text-muted-foreground opacity-25 [&>button]:text-muted-foreground",

              disabled:
                "pointer-events-none text-muted-foreground opacity-25",

              hidden:
                "invisible",
            }}
          />
        </div>

        {/* FOOTER */}

        <div className="flex items-center justify-between border-t bg-muted/20 px-3 py-2.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={setToday}
          >
            Днес
          </Button>

          {clearable && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={clearDate}
            >
              Изчисти
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}


export function formatDateBG(value: string): string {
  if (!value) return "";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}
