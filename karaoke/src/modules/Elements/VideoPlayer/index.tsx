import { ComponentProps, ForwardedRef, forwardRef } from "react";
import isE2E from "~/modules/utils/isE2E";
import DirectVideoPlayer from "./DirectVideo";
import OfflineVideoPlayer from "./Offline";
import YoutubeVideoPlayer, { VideoPlayerRef } from "./Youtube";

const VideoPlayer = forwardRef(
  (props: ComponentProps<typeof YoutubeVideoPlayer>, ref: ForwardedRef<VideoPlayerRef>) => {
    const video = props.video ?? "";
    const isLocalVideo = video.startsWith("/songs/") || video.endsWith(".mp4") || video.endsWith(".webm");

    if (import.meta.env.VITE_APP_OFFLINE || isE2E()) {
      return <OfflineVideoPlayer {...props} ref={ref} />;
    } else if (isLocalVideo) {
      return <DirectVideoPlayer {...props} ref={ref} />;
    } else {
      return <YoutubeVideoPlayer {...props} ref={ref} />;
    }
  },
);

export default VideoPlayer;
export { VideoState } from "~/modules/Elements/VideoPlayer/VideoState";
export type { VideoPlayerRef } from "./Youtube";
