"use client";

import { UserButton } from "@clerk/nextjs";
import {
  ChevronDown,
  Check,
  Download,
  FilePlus2,
  History,
  Image as ImageIcon,
  Loader2,
  Moon,
  Share2,
  Sparkles,
  TriangleAlert,
  Upload,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { useRef, type ChangeEvent } from "react";

import { useWorkflowPersistence } from "@/hooks/use-workflow-persistence";
import { WorkflowExportFileSchema } from "@/lib/api/workflow-schemas";
import { useWorkflowStore } from "@/lib/workflow/store";

export function TopBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-3 py-3">
      <WorkflowNameBadge />
      <TopBarActions />
    </div>
  );
}

function WorkflowNameBadge() {
  const name = useWorkflowStore((s) => s.identity.name);
  const setName = useWorkflowStore((s) => s.setName);

  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-card/90 px-2 py-1 shadow-sm backdrop-blur">
      <button
        aria-label="Workflow menu"
        className="flex size-6 items-center justify-center rounded-full hover:bg-accent"
      >
        <WorkflowIcon className="size-3.5 text-emerald-400" />
      </button>
      <ChevronDown className="size-3 text-muted-foreground" />
      <input
        aria-label="Workflow name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-40 bg-transparent px-2 text-[13px] font-medium text-foreground/90 focus:outline-none"
      />
    </div>
  );
}

function TopBarActions() {
  const persistence = useWorkflowPersistence();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBusy =
    persistence.status === "saving" || persistence.status === "loading";

  const handleExport = () => {
    const blob = persistence.exportJson();
    if (!blob) return;
    const name =
      useWorkflowStore.getState().identity.name.trim() || "workflow";
    const safeName = name.replace(/[^a-z0-9-_]/gi, "-");
    triggerDownload(blob, `${safeName}.json`);
  };

  const handleImportFilePicked = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = WorkflowExportFileSchema.parse(JSON.parse(text));
      await persistence.importJson(parsed);
    } catch (error) {
      console.error("Failed to import workflow", error);
    }
  };

  return (
    <div className="pointer-events-auto relative flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleImportFilePicked}
        className="hidden"
      />

      <IconBubble label="Theme">
        <Moon className="size-4" />
      </IconBubble>

      <PillButton
        icon={<FilePlus2 className="size-3.5 text-emerald-400" />}
        onClick={() => void persistence.loadSample()}
        title={
          isBusy
            ? "Working…"
            : "Load the sample 4-branch workflow from the spec"
        }
      >
        Sample
      </PillButton>

      <PillButton
        icon={<Upload className="size-3.5" />}
        onClick={() => fileInputRef.current?.click()}
      >
        Import
      </PillButton>

      <PillButton
        icon={<Download className="size-3.5" />}
        onClick={handleExport}
      >
        Export
      </PillButton>

      <PillButton
        icon={<Share2 className="size-3.5" />}
      >
        Share
      </PillButton>

      <SaveButton
        status={persistence.status}
        errorMessage={persistence.errorMessage}
        onClick={persistence.save}
      />

      <PillButton icon={<Sparkles className="size-3.5 text-orange-400" />}>
        Turn workflow into app
      </PillButton>

      <div className="ml-1 flex size-8 items-center justify-center rounded-full bg-card/90 shadow-sm backdrop-blur">
        <UserButton
          appearance={{
            elements: { avatarBox: "size-7" },
          }}
        />
      </div>
    </div>
  );
}

function SaveButton({
  status,
  errorMessage,
  onClick,
}: {
  status: "idle" | "saving" | "loading" | "error";
  errorMessage: string | null;
  onClick: () => void;
}) {
  const label =
    status === "saving"
      ? "Saving…"
      : status === "error"
        ? "Save failed"
        : "Save";

  const icon =
    status === "saving" ? (
      <Loader2 className="size-3.5 animate-spin" />
    ) : status === "error" ? (
      <TriangleAlert className="size-3.5 text-rose-400" />
    ) : (
      <Check className="size-3.5 text-emerald-400" />
    );

  return (
    <PillButton
      icon={icon}
      onClick={onClick}
      title={errorMessage ?? undefined}
    >
      {label}
    </PillButton>
  );
}

function IconBubble({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-full bg-card/90 text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

function PillButton({
  icon,
  children,
  onClick,
  title,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-8 items-center gap-1.5 rounded-full bg-card/90 px-3 text-[13px] font-medium text-foreground/90 shadow-sm backdrop-blur transition-colors hover:bg-accent"
    >
      {icon}
      {children}
    </button>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export { History, ImageIcon };
