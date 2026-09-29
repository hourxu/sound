
import InstrumentSidebar from './Components/InstrumentSidebar';
import { forwardRef, MutableRefObject, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { GAME_MODE, PlayerSetup, SingSetup, Song } from '~/interfaces';
import { VideoPlayerRef, VideoState } from '~/modules/Elements/VideoPlayer';
import PlayersManager from '~/modules/Players/PlayersManager';
import SkipIntro from '~/routes/Game/Singing/GameOverlay/Components/SkipIntro';
import SkipOutro from '~/routes/Game/Singing/GameOverlay/Components/SkipOutro';
import { GraphicSetting, MobilePhoneModeSetting, useSettingValue } from '~/routes/Settings/SettingsState';
import GameState from '../../../../modules/GameEngine/GameState/GameState';
import DurationBar from './Components/DurationBar';
import Lyrics from './Components/Lyrics';
import ScoreText from './Components/ScoreText';

import CanvasDrawing from '~/modules/GameEngine/Drawing';
import fragShader from '~/modules/GameEngine/Drawing/Shaders/shader.frag?raw';
import vertShader from '~/modules/GameEngine/Drawing/Shaders/shader.vert?raw';
import tuple from '~/modules/utils/tuple';
import getPlayerScoreData from '~/routes/Game/Singing/GameOverlay/helpers/getPlayerScoreData';

interface Props {
  song: Song;
  currentStatus: VideoState;
  width: number;
  height: number;
  onSongEnd?: () => void;
  playerSetups: PlayerSetup[];
  duration: number;
  effectsEnabled: boolean;
  videoPlayerRef: MutableRefObject<VideoPlayerRef | null>;
  isPauseMenuVisible: boolean;
  singSetup?: SingSetup;
  onInstrumentChange?: (instruments: string[]) => void;
}

const MAX_RENDER_RESOLUTION_W = 1920;

const GameOverlay = forwardRef(function (
  {
    currentStatus,
    width,
    height,
    playerSetups,
    onSongEnd,
    effectsEnabled,
    videoPlayerRef,
    isPauseMenuVisible,
    duration,
    singSetup,
    song,
    onInstrumentChange,
  }: Props,
  fRef,
) {
  const [graphicLevel] = useSettingValue(GraphicSetting);
  const [mobilePhoneMode] = useSettingValue(MobilePhoneModeSetting);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const drawer = useRef<CanvasDrawing | null>(null);
  const lyrics = useRef<HTMLDivElement | null>(null);

  const overlayWidth = MAX_RENDER_RESOLUTION_W;
  const overlayHeight = overlayWidth * (height / width);

  const overlayScaleFactor = overlayHeight / height;

  useImperativeHandle(fRef, () => {
    return {
      pause: () => drawer.current?.pause(),
      resume: () => drawer.current?.resume(),
    };
  }, []);

  useEffect(() => {
    GameState.startInputMonitoring();

    return () => {
      GameState.stopInputMonitoring();
    };
  }, []);

  // const resolutionScaleFactor = overlayWidth / MAX_RENDER_RESOLUTION_W;

  useEffect(() => {
    if (!canvas.current || !lyrics.current) return;

    drawer.current = new CanvasDrawing(
      canvas.current,
      lyrics.current.offsetHeight * overlayScaleFactor,
      // resolutionScaleFactor,
    );
    drawer.current.start();

    return () => {
      drawer.current?.end();
    };
  }, [overlayScaleFactor]);

  useEffect(() => {
    if (isPauseMenuVisible && drawer.current?.isPlaying()) {
      drawer.current?.pause();
    } else if (!isPauseMenuVisible && !drawer.current?.isPlaying()) {
      drawer.current?.resume();
    }
  }, [isPauseMenuVisible]);

useEffect(() => {
  if (currentStatus === VideoState.ENDED && onSongEnd) {
    onSongEnd();
  }
}, [currentStatus, onSongEnd]);
const [activeInstruments, setActiveInstruments] = useState<string[]>(
  Array.isArray(singSetup?.instruments) ? singSetup.instruments : ['vocals', 'bass', 'drums', 'other']
);

const handleInstrumentChange = (instruments: string[]) => {
  setActiveInstruments(instruments);
  onInstrumentChange?.(instruments);
};
  const players = PlayersManager.getPlayers();
  const showMultipleLines = !mobilePhoneMode && players.length > 1;

  return (
    <div className="relative flex h-full flex-col font-bold text-white">
      {graphicLevel === 'high' && (
        <>
          <script type={'x-shader/x-fragment'} id={'plane-fs'}>
            {fragShader}
          </script>
          <script id="plane-vs" type="x-shader/x-vertex">
            {vertShader}
          </script>
          <div id="canvas" className="absolute inset-0 z-[10000] h-full w-full" />
        </>
      )}
      <div id="plane" className="absolute inset-0 h-full w-full" style={!effectsEnabled ? { opacity: 0 } : undefined}>
        <canvas
          ref={canvas}
          width={overlayWidth}
          height={overlayHeight}
          data-sampler="planeTexture"
          className="h-full w-full"
        />
      </div>
      {effectsEnabled && (
        <>
          <SkipIntro playerRef={videoPlayerRef} isEnabled={!isPauseMenuVisible} />
          <SkipOutro onSongEnd={onSongEnd} isEnabled={!isPauseMenuVisible} />
        </>
      )}
      <DurationBar players={playerSetups} currentStatus={currentStatus} duration={duration} />
      <div className="py-5">
        {showMultipleLines && (
          <Lyrics player={players[0]} effectsEnabled={effectsEnabled} showStatusForAllPlayers={players.length > 2} />
        )}
      </div>
      <div className="mobile:text-xl z-10 flex h-full flex-1 flex-col justify-around pr-4 text-right text-3xl">
        {effectsEnabled && (
          <>
            {GameState.getSingSetup()?.mode === GAME_MODE.CO_OP ? (
              <span data-test="players-score" data-score={Math.floor(GameState.getPlayerScore(0))}>
                <ScoreText score={GameState.getPlayerScore(0)} />
              </span>
            ) : (
              PlayersManager.getPlayers().map((player) => {
                const scores = PlayersManager.getPlayers().map((player) =>
                  tuple([player.number, GameState.getPlayerScore(player.number)]),
                );
                const { score, isFirst } = getPlayerScoreData(scores, player.number);

                return (
                  <span
                    className="typography relative"
                    key={player.number}
                    data-test={`player-${player.number}-score`}
                    data-score={Math.floor(score)}>
                    <ScoreText score={score} />
                    <div
                      className={`mobile:top-6 mobile:text-lg absolute top-10 rotate-12 text-xl transition-all duration-200 ${isFirst ? '-right-2' : '-right-36'}`}>
                      {isFirst ? <div className="motion-preset-pulse-sm opacity-75">🥇</div> : '🥇'}
                    </div>
                  </span>
                );
              })
            )}
          </>
        )}
      </div>
      <div className="py-5" ref={lyrics}>
        <Lyrics
          showStatusForAllPlayers={players.length > 2}
          player={players.length > 2 ? players[0] : players.at(-1)!}
          bottom
          effectsEnabled={effectsEnabled}
        />
        
      </div>
       {Array.isArray(singSetup?.instruments) && singSetup.instruments.length > 0 && (
      <InstrumentSidebar 
      songId={song?.id ?? ""} 
      instruments={activeInstruments} 
      onInstrumentChange={handleInstrumentChange} 
    />
      )}
    </div>
  );
});

export default GameOverlay;
