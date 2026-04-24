"use client";

import { PanelLeft } from "lucide-react";
import type { DragEvent } from "react";

import {
  NODE_DEFINITION_LIST,
  type AnyNodeDefinition,
} from "@/lib/workflow/node-definitions";
import { NODE_DND_MIME, serializeNodeKind } from "@/lib/workflow/dnd";

interface QuickAccessSidebarProps {
  expanded: boolean;
  onToggle: () => void;
}

export function QuickAccessSidebar({
  expanded,
  onToggle,
}: QuickAccessSidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col justify-between py-2">
      <div className="flex flex-col gap-0.5 px-2">
        <SidebarButton
          expanded={expanded}
          label={expanded ? "Close sidebar" : "Open sidebar"}
          onClick={onToggle}
          icon={<PanelLeft className="size-4" />}
        />
        {expanded && <SectionLabel>Quick Access</SectionLabel>}
        {!expanded && <div className="my-1 h-px bg-border/60" />}
        {NODE_DEFINITION_LIST.map((definition) => (
          <NodePaletteButton
            key={definition.kind}
            definition={definition}
            expanded={expanded}
          />
        ))}
      </div>

      <div className="px-2">
        <button
          aria-label="Account"
          className={[
            "flex h-8 items-center gap-3 rounded-md text-xs font-medium text-foreground/80 transition-colors hover:bg-accent",
            expanded ? "w-full px-1.5" : "w-8 justify-center",
          ].join(" ")}
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px]">
            M
          </span>
          {expanded && (
            <span className="truncate text-[13px] text-foreground/90">
              Account
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-3 pb-1 text-[10px] font-medium tracking-wider text-muted-foreground/80 uppercase">
      {children}
    </div>
  );
}

function SidebarButton({
  expanded,
  label,
  icon,
  onClick,
}: {
  expanded: boolean;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      title={expanded ? undefined : label}
      onClick={onClick}
      className={[
        "flex h-8 items-center gap-3 rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        expanded ? "w-full px-2" : "w-8 justify-center",
      ].join(" ")}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        {icon}
      </span>
      {expanded && (
        <span className="truncate text-[13px] text-foreground/90">{label}</span>
      )}
    </button>
  );
}

function NodePaletteButton({
  definition,
  expanded,
}: {
  definition: AnyNodeDefinition;
  expanded: boolean;
}) {
  const { Icon, label, description, accentClass, kind } = definition;

  const handleDragStart = (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData(NODE_DND_MIME, serializeNodeKind(kind));
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      title={expanded ? undefined : `${label} — drag to canvas`}
      className={[
        "group flex h-8 items-center gap-3 rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing",
        expanded ? "w-full px-2" : "w-8 justify-center",
      ].join(" ")}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        <Icon className={["size-4", accentClass].join(" ")} />
      </span>
      {expanded && (
        <span className="flex min-w-0 flex-1 flex-col items-start">
          <span className="truncate text-[13px] leading-none text-foreground/90">
            {label}
          </span>
          <span className="truncate text-[10px] leading-tight text-muted-foreground">
            {description}
          </span>
        </span>
      )}
    </button>
  );
}
