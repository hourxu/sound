import { useEffect, useRef } from "react";

const INSTRUMENTS = ["vocals", "bass", "drums", "other"] as const;

export function useInstrumentAudio(
  songId: string,
  enabledInstruments: string[],
  isPlaying: boolean,
) {
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});

  // Load audio files when songId changes
  useEffect(() => {
    const elements: Record<string, HTMLAudioElement> = {};

    INSTRUMENTS.forEach((instrument) => {
      const audio = new Audio(`/songs/${songId}/${instrument}.mp3`);
      audio.preload = "auto";
      audio.volume = 1;
      audio.muted = false;
      elements[instrument] = audio;
    });

    audioElementsRef.current = elements;

    return () => {
      INSTRUMENTS.forEach((instrument) => {
        elements[instrument]?.pause();
      });
    };
  }, [songId]);

  // Mute/unmute based on enabled instruments
  useEffect(() => {
    INSTRUMENTS.forEach((instrument) => {
      const audio = audioElementsRef.current[instrument];
      if (!audio) return;
      const shouldPlay = enabledInstruments.includes(instrument);
      audio.muted = !shouldPlay;
      audio.volume = shouldPlay ? 1 : 0;
    });
  }, [enabledInstruments]);

  // Play/pause
  useEffect(() => {
    INSTRUMENTS.forEach((instrument) => {
      const audio = audioElementsRef.current[instrument];
      if (!audio) return;
      if (isPlaying) {
        audio.play().catch(console.error);
      } else {
        audio.pause();
      }
    });
  }, [isPlaying]);
}