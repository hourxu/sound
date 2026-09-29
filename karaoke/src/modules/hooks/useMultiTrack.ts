import { useRef, useEffect, useCallback } from 'react';
import { TrackName } from '../GameEngine/TrackControl/TrackContol';

const TRACK_FILES: Record<TrackName, string> = {
  vocals: 'vocals.mp3',
  bass:   'bass.mp3',
  drums:  'drums.mp3',
  other:  'other.mp3',
};

export function useMultiTrack(songFolder: string) {
  const refs = useRef<Record<TrackName, HTMLAudioElement | null>>({
    vocals: null, bass: null, drums: null, other: null,
  });

  useEffect(() => {
    const tracks = Object.keys(TRACK_FILES) as TrackName[];
    tracks.forEach(track => {
      const audio = new Audio(`/songs/${songFolder}/${TRACK_FILES[track]}`);
      audio.preload = 'auto';
      refs.current[track] = audio;
    });
    return () => {
      tracks.forEach(track => {
        refs.current[track]?.pause();
        refs.current[track] = null;
      });
    };
  }, [songFolder]);

  const play = useCallback((time = 0) => {
    Object.values(refs.current).forEach(a => {
      if (a) { a.currentTime = time; a.play(); }
    });
  }, []);

  const pause = useCallback(() => {
    Object.values(refs.current).forEach(a => a?.pause());
  }, []);

  const seek = useCallback((time: number) => {
    Object.values(refs.current).forEach(a => { if (a) a.currentTime = time; });
  }, []);

  return { audioRefs: refs.current, play, pause, seek };
}