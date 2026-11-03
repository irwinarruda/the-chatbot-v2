import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Button } from "~/client/shared/components/ui/button";
import { Skeleton } from "~/client/shared/components/ui/skeleton";
import { useDictionary } from "~/client/shared/hooks/useDictionary";

interface AudioWaveformProps {
  src: string;
  theme?: "dark" | "light";
}

function readCanvasColorsFromTheme(element: HTMLElement) {
  const styles = getComputedStyle(element);
  const brand = styles.getPropertyValue("--brand").trim();
  return {
    waveColor: styles.getPropertyValue("--faint").trim(),
    progressColor: brand,
    cursorColor: brand,
  };
}

export function AudioWaveform({ src, theme = "dark" }: AudioWaveformProps) {
  const dictionary = useDictionary();
  const [container, setContainer] = useState<HTMLDivElement | undefined>(
    undefined,
  );
  const [wavesurfer, setWavesurfer] = useState<WaveSurfer | undefined>(
    undefined,
  );
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const onTogglePlayPause = () => {
    wavesurfer?.playPause();
  };
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!container) return;
    const instance = WaveSurfer.create({
      container,
      url: src,
      ...readCanvasColorsFromTheme(container),
      cursorWidth: 1,
      height: 32,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
    });
    setWavesurfer(instance);
    setIsReady(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    const unsubscribe = [
      instance.on("ready", () => {
        setDuration(instance.getDuration());
        setIsReady(true);
      }),
      instance.on("play", () => setIsPlaying(true)),
      instance.on("pause", () => setIsPlaying(false)),
      instance.on("finish", () => setIsPlaying(false)),
      instance.on("timeupdate", (time) => setCurrentTime(time)),
    ];
    return () => {
      for (const off of unsubscribe) off();
      instance.destroy();
      setWavesurfer(undefined);
    };
  }, [container, src, theme]);

  return (
    <div className="flex w-55 min-w-0 max-w-full items-center gap-2.5">
      <Button
        type="button"
        onClick={onTogglePlayPause}
        disabled={!isReady}
        aria-label={
          isPlaying ? dictionary.common.pauseAudio : dictionary.common.playAudio
        }
        aria-pressed={isPlaying}
        variant="outline"
        size="icon"
        className="pointer-fine:size-8 size-11 shrink-0 rounded-lg border-brand/25 bg-background/70 p-0 text-primary shadow-none hover:border-brand/45 hover:bg-brand/12 hover:text-primary disabled:opacity-40"
      >
        {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="relative h-8 w-full overflow-hidden rounded-md">
          <div
            ref={(node) => setContainer(node ?? undefined)}
            className="absolute inset-0 w-full overflow-hidden"
          />
          {!isReady ? (
            <Skeleton className="absolute inset-0 rounded-md bg-muted/70" />
          ) : null}
        </div>
        <span className="font-mono text-2xs text-muted-foreground tabular-nums tracking-wide">
          {isReady
            ? `${formatTime(currentTime)} / ${formatTime(duration)}`
            : "--:--"}
        </span>
      </div>
    </div>
  );
}
