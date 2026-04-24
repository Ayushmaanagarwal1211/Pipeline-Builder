import { Undo2, Redo2, Command } from "lucide-react";

export function BottomLeftControls() {
  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-20 flex items-center gap-1.5">
      <CircleButton label="Undo">
        <Undo2 className="size-3.5" />
      </CircleButton>
      <CircleButton label="Redo">
        <Redo2 className="size-3.5" />
      </CircleButton>
      <button className="flex h-7 items-center gap-1.5 rounded-full bg-card/90 px-2.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-foreground">
        <Command className="size-3" />
        Keyboard shortcuts
      </button>
    </div>
  );
}

function CircleButton({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      className="flex size-7 items-center justify-center rounded-full bg-card/90 text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}
