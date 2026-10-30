"use client";

import { ListFilter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FilterCombobox } from "@/components/ui/filter-combobox";

export type FilterOption = { label: string; value: string };
export type TableFilter = { field: string; label: string; options: FilterOption[] };

const ALL_FILTER_VALUE = "__all";

export function DataTableFilters({ filters, values, onChange, onReset, layout = "standard" }: { filters: TableFilter[]; values: Record<string, string>; onChange: (field: string, value: string) => void; onReset: () => void; layout?: "standard" | "balanced-4-3" }) {
  const balancedFourThree = layout === "balanced-4-3" && filters.length === 7;
  const activeCount = filters.length;
  const optionsWithAll = (options: FilterOption[]) => {
    const allOption = options.find((option) => option.value === ALL_FILTER_VALUE);
    return allOption ? options.map((option) => (option.value === ALL_FILTER_VALUE ? { ...option, label: "Semua" } : option)) : [{ label: "Semua", value: ALL_FILTER_VALUE }, ...options];
  };

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-base font-bold uppercase tracking-wide text-foreground">
          <ListFilter className="h-4 w-4" aria-hidden="true" />
          <span>Filters</span>
          {activeCount > 0 ? <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-slate-900">{activeCount}</span> : null}
        </div>
        <Button variant="ghost" size="sm" type="button" className="text-muted-foreground" onClick={onReset}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset Filters
        </Button>
      </div>
      <div className={`grid min-w-0 gap-3 [&>*]:min-w-0 ${balancedFourThree ? "sm:grid-cols-2 lg:grid-cols-12" : filters.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {filters.map((filter, index) => {
          const options = optionsWithAll(filter.options);
          const selectedValue = values[filter.field] ?? ALL_FILTER_VALUE;
          const isOnlyFilterOnLastRow = filters.length > 1 && filters.length % 2 === 1 && index === filters.length - 1;
          const balancedSpanClass = balancedFourThree ? `${index < 4 ? "lg:col-span-3" : "lg:col-span-4"} ${index === 6 ? "sm:col-span-2" : ""}` : "";
          const lastRowClass = balancedFourThree ? balancedSpanClass : isOnlyFilterOnLastRow ? "sm:col-span-2" : "";

          return (
            <div key={filter.field} className={`min-w-0 space-y-1.5 ${lastRowClass}`}>
              <p className="px-1 text-xs font-semibold text-foreground">{filter.label}</p>
              <FilterCombobox options={options} value={selectedValue} onValueChange={(value) => onChange(filter.field, value)} label={filter.label} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
