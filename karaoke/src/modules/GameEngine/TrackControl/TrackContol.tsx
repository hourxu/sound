import { useState, useEffect } from 'react';

export type TrackName = 'vocals' | 'bass' | 'drums' | 'other';

interface Track {
  name: TrackName;
  label: string;
  file: string;
  icon: string;
}

const TRACKS: Track[] = [
  { name: 'vocals', label: 'Vocals', file: 'vocals.mp3', icon: '🎤' },
  { name: 'bass',   label: 'Bass',   file: 'bass.mp3',   icon: '🎸' },
  { name: 'drums',  label: 'Drums',  file: 'drums.mp3',  icon: '🥁' },
  { name: 'other',  label: 'Other',  file: 'other.mp3',  icon: '🎹' },
];

interface Props {
  audioRefs: Partial<Record<TrackName, HTMLAudioElement | null>>;
  defaultOn?: TrackName[];
}

export function TrackControls({ audioRefs, defaultOn = ['vocals', 'bass', 'drums', 'other'] }: Props) {
  const [enabled, setEnabled] = useState<Record<TrackName, boolean>>({
    vocals: defaultOn.includes('vocals'),
    bass:   defaultOn.includes('bass'),
    drums:  defaultOn.includes('drums'),
    other:  defaultOn.includes('other'),
  });

  const toggle = (track: TrackName) => {
    setEnabled(prev => {
      const next = { ...prev, [track]: !prev[track] };
      const audio = audioRefs[track];
      if (audio) audio.volume = next[track] ? 1 : 0;
      return next;
    });
  };

  // Sync volume whenever audioRefs mount
  useEffect(() => {
    (Object.keys(enabled) as TrackName[]).forEach(track => {
      const audio = audioRefs[track];
      if (audio) audio.volume = enabled[track] ? 1 : 0;
    });
  }, [audioRefs]);

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {TRACKS.map(({ name, label, icon }) => (
        <button
          key={name}
          onClick={() => toggle(name)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 4, padding: '10px 18px',
            border: `1.5px solid ${enabled[name] ? '#1D9E75' : '#ccc'}`,
            borderRadius: 12,
            background: enabled[name] ? '#EAF3DE' : '#f5f5f5',
            color: enabled[name] ? '#3B6D11' : '#999',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
            opacity: enabled[name] ? 1 : 0.5,
            transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span>{label}</span>
          <span style={{ fontSize: 10, letterSpacing: '0.06em' }}>
            {enabled[name] ? 'ON' : 'OFF'}
          </span>
        </button>
      ))}
    </div>
  );
}