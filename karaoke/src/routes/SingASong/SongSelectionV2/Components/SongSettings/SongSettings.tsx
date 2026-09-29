import { useEffect } from "react";
import { v4 } from "uuid";
import { GAME_MODE, SingSetup, SongPreview } from "~/interfaces";
import events from "~/modules/GameEvents/GameEvents";
import GameSettings from "~/routes/SingASong/SongSelectionV2/Components/SongSettings/GameSettings";
import MicCheck from "~/routes/SingASong/SongSelectionV2/Components/SongSettings/MicCheck";
import InstrumentSettings from "~/routes/SingASong/SongSelection/Components/SongSettings/InstrumentSettings";
import { useState } from "react";

interface Props {
  songPreview: SongPreview;
  onPlay: (setup: SingSetup & { song: SongPreview }) => void;
  keyboardControl: boolean;
  onExitKeyboardControl: () => void;
}

export default function SongSettings({ songPreview, onPlay, keyboardControl, onExitKeyboardControl }: Props) {
  const [singSetup, setSingSetup] = useState<SingSetup | null>(null);
  const [step, setStep] = useState<"song" | "instruments">("song");

 const onSongStepFinish = (setup: SingSetup) => {
    setSingSetup(setup);
    const finalSetup = { ...setup, instruments: ["vocals", "bass", "drums", "other"] };
    onPlay({ song: songPreview, ...finalSetup });
  };

  const onInstrumentStepFinish = (setup: SingSetup & { instruments: string[] }) => {
    events.songStarted.dispatch(songPreview, setup);
    onPlay({ song: songPreview, ...setup });
  };

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:gap-24 [&_hr]:opacity-25">
      <MicCheck className="w-full shrink-0 sm:w-2/5" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">
        {step === "song" && (
          <GameSettings
            songPreview={songPreview}
            onNextStep={onSongStepFinish}
            keyboardControl={keyboardControl}
            onExitKeyboardControl={onExitKeyboardControl}
          />
        )}
        {step === "instruments" && singSetup && (
          <InstrumentSettings
            songPreview={songPreview}
            singSetup={singSetup}
            onNextStep={onInstrumentStepFinish}
            keyboardControl={keyboardControl}
            onExitKeyboardControl={() => setStep("song")}
          />
        )}
      </div>
    </div>
  );
}
