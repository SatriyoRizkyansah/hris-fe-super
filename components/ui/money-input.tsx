"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

type MoneyInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type" | "inputMode"> & {
  value: string;
  onValueChange: (value: string) => void;
};

function groupThousands(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function MoneyInput({ value, onValueChange, className, ...props }: MoneyInputProps) {
  return (
    <span className="flex h-9 min-w-0 items-center rounded-md border border-input bg-background px-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40 [&_[data-slot=input]]:h-full [&_[data-slot=input]]:border-0 [&_[data-slot=input]]:bg-transparent [&_[data-slot=input]]:px-0 [&_[data-slot=input]]:py-0 [&_[data-slot=input]]:shadow-none [&_[data-slot=input]]:focus-visible:border-0 [&_[data-slot=input]]:focus-visible:ring-0">
      <span className="mr-2 shrink-0 text-sm text-muted-foreground" aria-hidden="true">
        Rp
      </span>
      <Input {...props} type="text" inputMode="numeric" value={groupThousands(value)} onChange={(event) => onValueChange(event.target.value.replace(/\D/g, ""))} className={className} />
    </span>
  );
}

export { MoneyInput };
