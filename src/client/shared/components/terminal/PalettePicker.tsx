import type { Palette } from "~/client/shared/app/entities/Prefs";
import { cn } from "~/client/shared/components/ui/lib/utils";
import { usePrefs } from "~/client/shared/hooks/usePrefs";
import { useApp } from "~/client/shared/stores/app";
import { TerminalChromeButton } from "./TerminalChromeButton";

type PalettePickerLabels = Record<Palette, string> & { label: string };

const Swatches: Record<Palette, string> = {
  barro: "bg-swatch-barro",
  favo: "bg-swatch-favo",
  lila: "bg-swatch-lila",
};

const Palettes = Object.keys(Swatches) as Palette[];

export function PalettePicker({ labels }: { labels: PalettePickerLabels }) {
  const prefs = usePrefs();
  const choosePalette = useApp((state) => state.choosePalette);

  return (
    <fieldset aria-label={labels.label} className="flex items-center">
      {Palettes.map((palette) => (
        <TerminalChromeButton
          key={palette}
          className="group"
          onClick={() => choosePalette(palette)}
          pressed={prefs.palette === palette}
          title={labels[palette]}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-2.5 rounded-full outline-offset-2 group-aria-pressed:outline-2 group-aria-pressed:outline-muted-foreground",
              Swatches[palette],
            )}
          />
        </TerminalChromeButton>
      ))}
    </fieldset>
  );
}
