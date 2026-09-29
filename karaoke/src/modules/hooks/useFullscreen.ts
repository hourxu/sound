import { useEffect } from 'react';
import { AutoEnableFullscreenSetting, useSettingValue } from '~/routes/Settings/SettingsState';

export default function useFullscreen() {
  const [autoEnableFullscreen] = useSettingValue(AutoEnableFullscreenSetting);

  useEffect(() => {
    if (!autoEnableFullscreen) return;
    if (document.fullscreenElement !== null) return; // already fullscreen

    const enterFullscreen = () => {
      document.body.requestFullscreen().catch(console.info);
      document.removeEventListener('click', enterFullscreen);
      document.removeEventListener('keydown', enterFullscreen);
    };

    document.addEventListener('click', enterFullscreen, { once: true });
    document.addEventListener('keydown', enterFullscreen, { once: true });

    return () => {
      document.removeEventListener('click', enterFullscreen);
      document.removeEventListener('keydown', enterFullscreen);
    };
  }, [autoEnableFullscreen]);
}