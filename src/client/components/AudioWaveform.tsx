import WaveSurfer from "wavesurfer.js";
import { useCallback, useEffect, useState } from "react";

interface AudioWaveformProps {
  src: string;
  theme?: "dark" | "light";
}

export function AudioWaveform({ src, theme = "dark" }: AudioWaveformProps) {
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

  const colors =
    theme === "light"
      ? {
          waveColor: "rgba(11, 125, 78, 0.35)",
          progressColor: "#0b7d4e",
          cursorColor: "#0b7d4e",
        }
      : {
          waveColor: "rgba(80, 223, 170, 0.35)",
          progressColor: "#50dfaa",
          cursorColor: "#50dfaa",
        };

  useEffect(() => {
    if (!container) return;

    const instance = WaveSurfer.create({
      container,
      url: src,
      waveColor: colors.waveColor,
      progressColor: colors.progressColor,
      cursorColor: colors.cursorColor,
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
  }, [
    container,
    src,
    colors.waveColor,
    colors.progressColor,
    colors.cursorColor,
  ]);

  const togglePlayPause = useCallback(() => {
    wavesurfer?.playPause();
  }, [wavesurfer]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex min-w-[220px] max-w-[280px] items-center gap-2">
      <button
        type="button"
        onClick={togglePlayPause}
        disabled={!isReady}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-md border border-term-border bg-term-bg p-0 text-term-green transition-colors duration-200 hover:border-term-green/40 hover:bg-term-green/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div
          ref={(node) => setContainer(node ?? undefined)}
          className="w-full overflow-hidden rounded"
        />
        <span className="text-2xs tracking-wide text-term-muted">
          {isReady
            ? `${formatTime(currentTime)} / ${formatTime(duration)}`
            : "--:--"}
        </span>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <polygon points="6,3 20,12 6,21" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="5" y="3" width="5" height="18" rx="1" />
      <rect x="14" y="3" width="5" height="18" rx="1" />
    </svg>
  );
}
