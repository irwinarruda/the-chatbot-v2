import { useWavesurfer } from "@wavesurfer/react";
import { useCallback, useEffect, useRef, useState } from "react";

interface AudioWaveformProps {
  src: string;
  theme?: "dark" | "light";
}

export function AudioWaveform({ src, theme = "dark" }: AudioWaveformProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState(0);

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

  const { wavesurfer, isReady, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
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

  useEffect(() => {
    if (!wavesurfer) return;
    const onReady = () => {
      setDuration(wavesurfer.getDuration());
    };
    wavesurfer.on("ready", onReady);
    return () => {
      wavesurfer.un("ready", onReady);
    };
  }, [wavesurfer]);

  useEffect(() => {
    if (!wavesurfer) return;
    wavesurfer.setOptions({
      waveColor: colors.waveColor,
      progressColor: colors.progressColor,
      cursorColor: colors.cursorColor,
    });
  }, [wavesurfer, colors.waveColor, colors.progressColor, colors.cursorColor]);

  const togglePlayPause = useCallback(() => {
    wavesurfer?.playPause();
  }, [wavesurfer]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="audio-waveform">
      <button
        type="button"
        className="audio-waveform-play"
        onClick={togglePlayPause}
        disabled={!isReady}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div className="audio-waveform-track">
        <div ref={containerRef} className="audio-waveform-container" />
        <span className="audio-waveform-time">
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
