"use client";

import { useId, useRef, useState } from "react";
import { CheckCircle2, Download, FileText, LoaderCircle, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "cn";

export type DocumentUploadFieldProps = {
  label: string;
  accept: string;
  value: File | null;
  onChange: (file: File | null) => void;
  onUpload?: () => void;
  currentFile?: string | null;
  apiBaseUrl?: string;
  pending?: boolean;
  disabled?: boolean;
  className?: string;
};

function documentUrl(path: string, apiBaseUrl?: string) {
  const normalizedPath = path.replace(/^\/+/, "").replace(/^api\//, "");
  const base = (apiBaseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/api/${normalizedPath.startsWith("uploaded/") ? normalizedPath : `uploaded/${normalizedPath.replace(/^uploads\//, "")}`}`;
}

export function DocumentUploadField({ label, accept, value, onChange, onUpload, currentFile, apiBaseUrl, pending = false, disabled = false, className }: DocumentUploadFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [invalidFile, setInvalidFile] = useState(false);
  const hasCurrentFile = Boolean(currentFile);

  return (
    <div className={cn("min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5", className)}>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
        <FileText className="size-4 text-primary" />
        <label htmlFor={inputId}>{label}</label>
      </div>
      <div className="flex min-h-[72px] flex-col gap-3 rounded-xl border border-dashed border-input bg-muted/20 p-3 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          disabled={disabled || pending}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setInvalidFile(Boolean(file && accept && !accept.split(",").some((extension) => file.name.toLowerCase().endsWith(extension.trim().toLowerCase()))));
            onChange(file);
          }}
        />
        <Button type="button" variant="outline" disabled={disabled || pending} onClick={() => inputRef.current?.click()}>
          <Upload /> Pilih File
        </Button>
        <div className="min-w-0 flex-1">
          {value ? (
            <p className="truncate text-sm font-medium" title={value.name}>
              {value.name}
            </p>
          ) : hasCurrentFile ? (
            <a className="inline-flex max-w-full items-center gap-2 truncate text-sm font-medium text-primary underline-offset-4 hover:underline" href={documentUrl(currentFile!, apiBaseUrl)} target="_blank" rel="noreferrer">
              <CheckCircle2 className="size-4 shrink-0" /> Lihat dokumen tersimpan
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada file dipilih</p>
          )}
          {invalidFile && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              Format file tidak sesuai: {accept}
            </p>
          )}
        </div>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Hapus pilihan file"
            disabled={pending}
            onClick={() => {
              onChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            <X />
          </Button>
        )}
        {onUpload && (
          <Button type="button" disabled={!value || invalidFile || pending || disabled} onClick={onUpload}>
            {pending ? <LoaderCircle className="animate-spin" /> : hasCurrentFile && !value ? <Download /> : <Upload />}
            {pending ? "Mengunggah..." : "Upload"}
          </Button>
        )}
      </div>
    </div>
  );
}
