import { CheckCircleOutline } from '@mui/icons-material';
import { useEffect, useState } from 'react';
import CountUp from 'react-countup';
import Typography from '~/modules/Elements/AKUI/Primitives/Typography';
import Loader from '~/modules/Elements/Loader';
import events from '~/modules/GameEvents/GameEvents';
import { useEventEffect, useEventListenerSelector } from '~/modules/GameEvents/hooks';
import PlayersManager from '~/modules/Players/PlayersManager';
import { waitFinished, waitForReadinessMusic } from '~/modules/SoundManager';
import isE2E from '~/modules/utils/isE2E';
import sleep from '~/modules/utils/sleep';
import SinglePlayer from '~/routes/SingASong/SongSelection/Components/SongSettings/MicCheck/SinglePlayer';

interface Props {
  onFinish: () => void;
}

const AUTOSTART_TIMEOUT_S = 0;

function WaitForReadiness({ onFinish }: Props) {
  const [areAllPlayersReady, setAreAllPlayersReady] = useState(false);

  const [confirmedPlayers, setConfirmedPlayers] = useState<string[]>([]);
  useEventEffect(events.readinessConfirmed, (deviceId) => {
    setConfirmedPlayers((current) => [...current, deviceId]);
  });

  const players = useEventListenerSelector([events.inputListChanged, events.readinessConfirmed], () => {
    return PlayersManager.getPlayers().map((player) => [player.input.deviceId!, player.getName(), player] as const);
  });

  useEffect(() => {
    (async () => {
      // can't use `areAllPlayersReady` as it would need to be specified as useEffect dependency
      let allInputsReady = false;
      const inputsReady = PlayersManager.requestReadiness().then(() => {
        allInputsReady = true;
        setAreAllPlayersReady(true);
      });
      const minTimeElapsed = sleep(0);
      const maxTimeElapsed = sleep(AUTOSTART_TIMEOUT_S * 1_000);

      // Only start the music if waiting for readiness takes some time
      await sleep(250);
      if (!allInputsReady) {
        await waitForReadinessMusic.play(false);
      }

      await Promise.race([Promise.all([inputsReady, minTimeElapsed]), maxTimeElapsed]);
      if (waitForReadinessMusic.playing()) waitFinished.play();
      await sleep(0);
      waitForReadinessMusic.stop();
      await sleep(1000);
      onFinish();
    })();
  }, []);


  return (
    <div className="typography absolute inset-0 z-[1000] flex h-full w-full flex-col items-center justify-center gap-8 text-xl">
      {!areAllPlayersReady && (
        <Typography className="text-2xl">
          Waiting for all players to click <strong>&quot;Ready&quot;</strong>
        </Typography>
      )}
      {!areAllPlayersReady && (
        <Typography className="text-2xl">
          The song will start automatically in{' '}
          <strong>
            <CountUp end={0} start={AUTOSTART_TIMEOUT_S} duration={AUTOSTART_TIMEOUT_S} useEasing={false} />
          </strong>
        </Typography>
      )}
    </div>
  );
}

export default WaitForReadiness;
