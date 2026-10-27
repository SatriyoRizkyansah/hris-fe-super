import { Fragment } from "react";
import { formatRupiah } from "@/lib/hris/format";

export type MoneyFlowItem = {
  label: string;
  amount: unknown;
  operator?: string;
  tone?: string;
};

/** Compact equation row for budget and cash balances. */
export function MoneyFlow({ items }: { items: MoneyFlowItem[] }) {
  return (
    <div className="overflow-hidden rounded-md border bg-white">
      <div className="flex flex-col divide-y sm:flex-row sm:items-stretch sm:divide-y-0">
        {items.map((item, index) => (
          <Fragment key={item.label}>
            <div className="min-w-0 flex-1 px-3 py-2.5 sm:flex sm:flex-col sm:justify-center">
              <p className="text-xs text-muted-foreground">
                {index > 0 && <span className="mr-1 font-semibold sm:hidden">{item.operator ?? "−"}</span>}
                {item.label}
              </p>
              <p className={`mt-1 text-sm font-semibold tabular-nums ${item.tone ?? "text-foreground"}`}>{formatRupiah(item.amount)}</p>
            </div>
            {index < items.length - 1 && <span className="hidden shrink-0 items-center px-2 text-lg text-muted-foreground sm:flex">{items[index + 1].operator ?? "−"}</span>}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
