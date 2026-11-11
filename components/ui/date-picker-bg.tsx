"use client";

import * as React from "react";
import {
  format,
  isValid,
  parse,
  parseISO,
} from "date-fns";
import { bg } from "date-fns/locale";
import { CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
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

/**
 * 2        -> 2
 * 22       -> 22/
 * 220      -> 22/0
 * 2209     -> 22/09/
 * 22092026 -> 22/09/2026
 */
function maskDateInput(rawValue: string) {
  /*
   * Позволява paste и на ISO формат:
   * 2026-09-22 -> 22/09/2026
   */
  const isoMatch = rawValue.match(
    /^(\d{4})-(\d{2})-(\d{2})$/,
  );

  if (isoMatch) {
    const [, year, month, day] = isoMatch;

    return `${day}/${month}/${year}`;
  }

  const digits = rawValue
    .replace(/\D/g, "")
    .slice(0, 8);

  if (!digits) {
    return "";
  }

  if (digits.length < 2) {
    return digits;
  }

  if (digits.length === 2) {
    return `${digits}/`;
  }

  if (digits.length < 4) {
    return `${digits.slice(
      0,
      2,
    )}/${digits.slice(2)}`;
  }

  if (digits.length === 4) {
    return `${digits.slice(
      0,
      2,
    )}/${digits.slice(2, 4)}/`;
  }

  return `${digits.slice(
    0,
    2,
  )}/${digits.slice(
    2,
    4,
  )}/${digits.slice(4, 8)}`;
}

function inputToDate(
  value: string,
): Date | undefined {
  if (
    !/^\d{2}\/\d{2}\/\d{4}$/.test(value)
  ) {
    return undefined;
  }

  const parsed = parse(
    value,
    "dd/MM/yyyy",
    new Date(),
  );

  if (!isValid(parsed)) {
    return undefined;
  }

  /*
   * Предпазва от:
   *
   * 31/02/2026
   * 32/01/2026
   * 15/14/2026
   *
   * date-fns не трябва да може да нормализира
   * невалидната дата незабелязано.
   */
  if (
    format(parsed, "dd/MM/yyyy") !== value
  ) {
    return undefined;
  }

  return parsed;
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

  const [inputValue, setInputValue] =
    React.useState(() =>
      value ? formatDateBG(value) : "",
    );

  const [invalid, setInvalid] =
    React.useState(false);

  const inputRef =
    React.useRef<HTMLInputElement>(null);

  const selectedDate =
    isoToDate(value);

  const min =
    isoToDate(minDate);

  const max =
    isoToDate(maxDate);

  /*
   * Ако value бъде променено отвън,
   * обновяваме и текста в input-а.
   */
  React.useEffect(() => {
    setInputValue(
      value ? formatDateBG(value) : "",
    );

    setInvalid(false);
  }, [value]);

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

  function commitInput(
    nextValue: string,
  ) {
    if (!nextValue) {
      setInvalid(false);
      onChange("");

      return true;
    }

    const date =
      inputToDate(nextValue);

    if (!date) {
      setInvalid(true);

      return false;
    }

    if (isDisabled(date)) {
      setInvalid(true);

      return false;
    }

    setInvalid(false);

    const iso =
      dateToIso(date);

    onChange(iso);

    setInputValue(
      format(date, "dd/MM/yyyy"),
    );

    return true;
  }

  function handleInputChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const nextValue =
      maskDateInput(
        event.target.value,
      );

    setInputValue(nextValue);

    /*
     * Докато потребителят още пише,
     * не показваме грешка.
     */
    setInvalid(false);

    if (!nextValue) {
      onChange("");

      return;
    }

    /*
     * 22/09/2026 = 10 символа.
     *
     * В момента, в който датата стане
     * пълна, я записваме автоматично.
     */
    if (nextValue.length === 10) {
      commitInput(nextValue);
    }
  }

  function handleInputBlur() {
    if (!inputValue) {
      setInvalid(false);

      if (value) {
        onChange("");
      }

      return;
    }

    /*
     * Ако е пълна и валидна,
     * записваме.
     */
    if (
      inputValue.length === 10 &&
      commitInput(inputValue)
    ) {
      return;
    }

    /*
     * Ако потребителят напусне полето
     * с недовършена/невалидна дата,
     * връщаме последната валидна стойност.
     */
    setInputValue(
      value ? formatDateBG(value) : "",
    );

    setInvalid(false);
  }

  function handleInputKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();

      if (
        inputValue.length === 10 &&
        commitInput(inputValue)
      ) {
        setOpen(false);

        inputRef.current?.blur();
      }

      return;
    }

    if (event.key === "Escape") {
      setInputValue(
        value
          ? formatDateBG(value)
          : "",
      );

      setInvalid(false);
      setOpen(false);

      inputRef.current?.blur();

      return;
    }

    /*
     * Специално обработване на Backspace.
     *
     * Например:
     *
     * 22/|
     *
     * Backspace ->
     *
     * 2|
     *
     * Иначе автоматичната "/" би се
     * появявала отново веднага.
     */
    if (
      event.key === "Backspace"
    ) {
      const input =
        event.currentTarget;

      const start =
        input.selectionStart ?? 0;

      const end =
        input.selectionEnd ?? 0;

      if (
        start === end &&
        start > 0 &&
        inputValue[start - 1] === "/"
      ) {
        event.preventDefault();

        const beforeSlash =
          inputValue.slice(
            0,
            start - 1,
          );

        const afterSlash =
          inputValue.slice(start);

        const beforeDigits =
          beforeSlash.replace(
            /\D/g,
            "",
          );

        const afterDigits =
          afterSlash.replace(
            /\D/g,
            "",
          );

        const nextDigits =
          beforeDigits.slice(0, -1) +
          afterDigits;

        const nextValue =
          maskDateInput(nextDigits);

        setInputValue(nextValue);
        setInvalid(false);

        if (!nextValue) {
          onChange("");
        }

        requestAnimationFrame(() => {
          const element =
            inputRef.current;

          if (!element) return;

          /*
           * Най-често cursor-ът трябва
           * да остане в края.
           */
          const position =
            nextValue.length;

          element.setSelectionRange(
            position,
            position,
          );
        });
      }
    }
  }

  function handleSelect(
    date: Date | undefined,
  ) {
    if (!date) return;

    const iso =
      dateToIso(date);

    onChange(iso);

    setInputValue(
      format(date, "dd/MM/yyyy"),
    );

    setInvalid(false);

    setOpen(false);
  }

  function setToday() {
    const today = new Date();

    if (isDisabled(today)) {
      return;
    }

    const iso =
      dateToIso(today);

    onChange(iso);

    setInputValue(
      format(
        today,
        "dd/MM/yyyy",
      ),
    );

    setInvalid(false);

    setOpen(false);
  }

  function clearDate() {
    onChange("");

    setInputValue("");

    setInvalid(false);

    setOpen(false);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  return (
    <div
      className={cn(
        "relative w-full",
        className,
      )}
    >
      <Input
        ref={inputRef}
        type="text"
        value={inputValue}
        disabled={disabled}
        placeholder={placeholder}
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        aria-invalid={invalid}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
        className={cn(
          "h-10 w-full rounded-xl pr-10",
          "border-input/80 bg-background",
          "text-sm font-normal",
          "shadow-[0_1px_2px_rgb(0_0_0/0.03)]",
          "transition-[border-color,box-shadow,background-color] duration-150",
          "hover:border-foreground/20",
          "focus-visible:border-ring",
          "focus-visible:ring-3",
          "focus-visible:ring-ring/15",

          invalid &&
            "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/15",
        )}
      />

      <Popover
        open={open}
        onOpenChange={setOpen}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className={cn(
              "absolute right-1 top-1/2",
              "size-8 -translate-y-1/2",
              "rounded-lg",
              "text-muted-foreground",
              "hover:bg-muted",
              "hover:text-foreground",
            )}
            aria-label="Отвори календар"
          >
            <CalendarDays className="size-4" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
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
            "backdrop-blur-none",
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
              defaultMonth={
                selectedDate ??
                min ??
                undefined
              }
              onSelect={handleSelect}
              disabled={isDisabled}
              locale={bg}
              weekStartsOn={1}
              showOutsideDays
              formatters={{
                formatWeekdayName: (
                  date,
                ) =>
                  format(
                    date,
                    "EEEEEE",
                    {
                      locale: bg,
                    },
                  ),
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
                  "inline-flex size-7 items-center justify-center rounded-lg border border-transparent bg-transparent p-0 text-muted-foreground transition-colors hover:border-border/60 hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/20",

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
    </div>
  );
}

export function formatDateBG(
  value: string,
): string {
  if (!value) return "";

  const [year, month, day] =
    value.split("-");

  if (
    !year ||
    !month ||
    !day
  ) {
    return value;
  }

  return `${day}/${month}/${year}`;
}