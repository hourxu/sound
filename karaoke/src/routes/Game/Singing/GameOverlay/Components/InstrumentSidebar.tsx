import { useEffect, useRef } from "react";

const INSTRUMENTS = ["vocals", "bass", "drums", "other"] as const;
type Instrument = (typeof INSTRUMENTS)[number];

const instrumentLabels: Record<Instrument, { label: string; emoji: string }> = {
  vocals: { label: "Vocals", emoji: "🎤" },
  bass: { label: "Bass", emoji: "🎸" },
  drums: { label: "Drums", emoji: "🥁" },
  other: { label: "Other", emoji: "🎵" },
};

interface Props {
  songId: string;
  instruments: string[];
  onInstrumentChange: (instruments: string[]) => void;
}

export default function InstrumentSidebar({ instruments, onInstrumentChange }: Props) {
  const toggle = (instrument: Instrument) => {
    const newInstruments = instruments.includes(instrument)
      ? instruments.filter((i) => i !== instrument)
      : [...instruments, instrument];
    console.log("Toggle instrument:", instrument, newInstruments);
    onInstrumentChange(newInstruments);
  };

  return (
    <div style={{
      position: "fixed",
      right: "1rem",
      top: "50%",
      transform: "translateY(-50%)",
      zIndex: 99999,
      display: "flex",
      flexDirection: "column",
      gap: "0.5rem",
      background: "rgba(0,0,0,0.7)",
      padding: "1rem",
      borderRadius: "0.5rem",
    }}>
      {INSTRUMENTS.map((instrument) => (
        <button
          key={instrument}
          onClick={() => toggle(instrument)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "0.25rem",
            border: "none",
            cursor: "pointer",
            background: instruments.includes(instrument) ? "#f59e0b" : "#374151",
            color: instruments.includes(instrument) ? "#000" : "#fff",
            fontWeight: "bold",
            fontSize: "1rem",
            minWidth: "8rem",
          }}>
          <span>{instrumentLabels[instrument].emoji}</span>
          <span>{instrumentLabels[instrument].label}</span>
          <span style={{ marginLeft: "auto" }}>{instruments.includes(instrument) ? "ON" : "OFF"}</span>
        </button>
      ))}
    </div>
  );
}