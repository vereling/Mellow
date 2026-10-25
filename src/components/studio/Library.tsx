import { layerAtPlayhead } from "@/lib/studio/actions";
import { cn } from "@/lib/cn";
import { useStudio } from "@/lib/studio/store";
import type { AssetGroup, AssetMeta } from "@/lib/studio/types";
import { Plus, Trash2 } from "lucide-react";

const ORDER: AssetGroup[] = ["Loops", "One-shots", "Imported", "Recordings"];

function SoundButton({ asset, compact }: { asset: AssetMeta; compact?: boolean }) {
  const booted = useStudio((state) => state.booted);
  const removeAsset = useStudio((state) => state.removeAsset);
  return (
    <div className={cn("flex items-stretch gap-1", compact ? "w-44 shrink-0" : "w-full")}>
      <button
        type="button"
        disabled={!booted}
        draggable={booted}
        onDragStart={(event) => {
          event.dataTransfer.setData("application/x-mellow-asset", asset.id);
          event.dataTransfer.setData("text/plain", asset.name);
          event.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => layerAtPlayhead(asset.id)}
        className="flex min-h-14 min-w-0 flex-1 flex-col items-start justify-center rounded-xl bg-inset px-3 py-2 text-left disabled:opacity-50"
      >
        <span className="w-full truncate text-sm font-medium text-fg">{asset.name}</span>
        <span className="text-xs text-muted">{asset.hint}</span>
      </button>
      {asset.builtin ? null : (
        <button
          type="button"
          aria-label={`Remove ${asset.name}`}
          onClick={() => removeAsset(asset.id)}
          className="flex w-11 items-center justify-center rounded-xl bg-inset text-muted hover:text-fg"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Library({ onImport }: { onImport: () => void }) {
  const assets = useStudio((state) => state.assets);
  const booted = useStudio((state) => state.booted);
  const addTrack = useStudio((state) => state.addTrack);

  return (
    <aside className="shrink-0 border-b border-line bg-surface md:flex md:w-64 md:min-h-0 md:flex-col md:border-r md:border-b-0">
      <div className="flex items-center justify-between px-3 pt-3">
        <p className="text-sm font-medium text-fg">Sounds</p>
        <button
          type="button"
          onClick={() => addTrack()}
          className="inline-flex h-10 items-center gap-1 rounded-full px-2 text-xs text-muted hover:text-fg"
        >
          <Plus className="h-4 w-4" />
          Track
        </button>
      </div>
      <p className="hidden px-3 pb-2 text-xs text-muted md:block">Tap to layer. Drop onto a track to place it.</p>
      <div className="flex gap-2 overflow-x-auto px-3 pb-3 md:hidden">
        <button
          type="button"
          onClick={onImport}
          className="flex h-14 w-28 shrink-0 items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted"
        >
          Import
        </button>
        {assets.map((asset) => (
          <SoundButton key={asset.id} asset={asset} compact />
        ))}
      </div>
      <div className="hidden min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4 md:flex">
        <button
          type="button"
          disabled={!booted}
          onClick={onImport}
          className="flex h-11 items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted hover:text-fg"
        >
          Import audio
        </button>
        {ORDER.map((group) => {
          const items = assets.filter((asset) => asset.group === group);
          if (!items.length) return null;
          return (
            <section key={group} className="flex flex-col gap-2">
              <h2 className="text-xs font-medium text-muted">{group}</h2>
              {items.map((asset) => (
                <SoundButton key={asset.id} asset={asset} />
              ))}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
