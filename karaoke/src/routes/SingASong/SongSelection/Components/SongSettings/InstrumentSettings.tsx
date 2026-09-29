/* @reactCompiler disable */
import { useState } from 'react';
import { SingSetup, SongPreview } from '~/interfaces';
import { Button } from '~/modules/Elements/AKUI/Button';
import { Switcher } from '~/modules/Elements/Switcher';
import useKeyboardNav from '~/modules/hooks/useKeyboardNav';

interface Props {
  songPreview: SongPreview;
  singSetup: SingSetup;
  onNextStep: (setup: Omit<SingSetup, 'instruments'> & { instruments: string[] }) => void;
  keyboardControl: boolean;
  onExitKeyboardControl: () => void;
}

const INSTRUMENTS = ['vocals', 'bass', 'drums', 'other'] as const;
type Instrument = (typeof INSTRUMENTS)[number];

const instrumentLabels: Record<Instrument, string> = {
  vocals: '🎤 Vocals',
  bass: '🎸 Bass',
  drums: '🥁 Drums',
  other: '🎵 Other',
};

export default function InstrumentSettings({
  singSetup,
  onNextStep,
  keyboardControl,
  onExitKeyboardControl,
}: Props) {
  const [selectedInstruments, setSelectedInstruments] = useState<Instrument[]>([
    'vocals', 'bass', 'drums', 'other',
  ]);

  const toggleInstrument = (instrument: Instrument) => {
    setSelectedInstruments((current) =>
      current.includes(instrument)
        ? current.filter((i) => i !== instrument)
        : [...current, instrument],
    );
  };

  const handleNext = () => {
    onNextStep({
      ...singSetup,
      instruments: selectedInstruments,
    });
  };

  const { register } = useKeyboardNav({
    enabled: keyboardControl,
    onBackspace: onExitKeyboardControl,
  });

  return (
    <>
      <div className="typography w-full bg-black/70 px-3 py-2 text-lg">
        Select instruments to play:
      </div>
      {INSTRUMENTS.map((instrument) => (
        <Switcher
          key={instrument}
          {...register(`instrument-${instrument}`, () => toggleInstrument(instrument), `Toggle ${instrument}`)}
          label={instrumentLabels[instrument]}
          value={selectedInstruments.includes(instrument) ? 'ON' : 'OFF'}
          className="w-full"
        />
      ))}
      <Button
        size="large"
        {...register('next-step-button', handleNext, undefined, true)}
        className="mobile:px-10 mobile:h-10 mobile:text-md px-20 py-1">
        Play ▶
      </Button>
    </>
  );
}