import { useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { Song } from '~/interfaces';
import { Menu } from '~/modules/Elements/AKUI/Menu';
import { MenuButton } from '~/modules/Elements/Menu';
import MenuWithLogo from '~/modules/Elements/MenuWithLogo';
import SmoothLink from '~/modules/Elements/SmoothLink';
import useKeyboardNav from '~/modules/hooks/useKeyboardNav';
import useSmoothNavigate from '~/modules/hooks/useSmoothNavigate';
import SongDao from '~/modules/Songs/SongsService';
import { useSetlist } from '~/modules/Songs/hooks/useSetlist';
import convertTxtToSong from '~/modules/Songs/utils/convertTxtToSong';
import getSongId from '~/modules/Songs/utils/getSongId';
import { shareSong } from '~/routes/Edit/ShareSongsModal';

const SEPARATE_ENDPOINT = 'http://localhost:8000/api/songs/separate';
const BACKEND_URL = 'http://localhost:8000';

interface StemUrls {
  songId: string;
  video: string;
  txt: string;
  mp3Vocals: string;
  mp3Bass: string;
  mp3Drums: string;
  mp3Other: string;
}

type AddSongStatus = 'idle' | 'uploading' | 'processing' | 'error';

function FileDropzone({
  label,
  hint,
  accept,
  file,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.75, fontWeight: 600, color: 'text.primary' }}>
        {label}
      </Typography>

      <Box
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (disabled) return;
          const dropped = event.dataTransfer.files?.[0];
          if (dropped) onChange(dropped);
        }}
        sx={{
          border: '2px dashed',
          borderColor: isDragging ? 'primary.main' : file ? 'success.main' : 'divider',
          borderRadius: 2,
          p: 2.5,
          textAlign: 'center',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          backgroundColor: isDragging ? 'action.hover' : file ? 'success.50' : 'background.default',
          transition: 'all 0.15s ease',
          '&:hover': disabled
            ? undefined
            : {
                borderColor: 'primary.main',
                backgroundColor: 'action.hover',
              },
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          hidden
          disabled={disabled}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />

        {file ? (
          <Stack spacing={0.25} alignItems="center">
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.dark' }}>
              ✓ {file.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Click to choose a different file
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={0.25} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Drag & drop, or click to browse
            </Typography>
            <Typography variant="caption" color="text.disabled">
              {hint}
            </Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function ManageSongs() {
  const navigate = useSmoothNavigate();
  const goBack = () => navigate('menu/');
  const setlist = useSetlist();

  const { register } = useKeyboardNav({ onBackspace: goBack });

  const [openAddSong, setOpenAddSong] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [txtFile, setTxtFile] = useState<File | null>(null);
  const [status, setStatus] = useState<AddSongStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const isBusy = status === 'uploading' || status === 'processing';

  const handleClose = () => {
    if (isBusy) return;
    setOpenAddSong(false);
    setYoutubeUrl('');
    setTxtFile(null);
    setStatus('idle');
    setProgress(0);
    setErrorMsg('');
  };

  const readFileAsText = (fileToRead: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Could not read the .txt file.'));
      reader.readAsText(fileToRead);
    });
  };

  const uploadAndSeparate = (songId: string, ytUrl: string, txt: File): Promise<StemUrls> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('songId', songId);
      formData.append('youtubeUrl', ytUrl);
      formData.append('txt', txt);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', SEPARATE_ENDPOINT);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error('Invalid response from separation backend.'));
          }
        } else {
          let message = `Separation request failed (${xhr.status}).`;
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.detail) message = response.detail;
          } catch {
            // Keep default error message.
          }
          reject(new Error(message));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error while uploading. Make sure the FastAPI backend is running on port 8000.'));
      };

      xhr.send(formData);
    });
  };

  const makeBackendUrl = (path: string) => {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `${BACKEND_URL}${path}`;
  };

  const handleAddSong = async () => {
    if (!youtubeUrl.trim() || !txtFile) {
      return;
    }

    setErrorMsg('');
    setStatus('uploading');
    setProgress(0);

    try {
      const txtContent = await readFileAsText(txtFile);
      const parsedSong = convertTxtToSong(txtContent, '', '', '', undefined);

      if (!parsedSong.artist || !parsedSong.title) {
        throw new Error('The .txt file is missing #ARTIST: or #TITLE: tags.');
      }

      const songId = getSongId({ artist: parsedSong.artist, title: parsedSong.title });

      const stems = await uploadAndSeparate(songId, youtubeUrl.trim(), txtFile);

      setStatus('processing');
      setProgress(100);

      const videoUrl = makeBackendUrl(stems.video);
      const drumsUrl = makeBackendUrl(stems.mp3Drums);
      const bassUrl = makeBackendUrl(stems.mp3Bass);
      const otherUrl = makeBackendUrl(stems.mp3Other);

      const finalSong: Song = {
        ...parsedSong,
        id: songId,
        // The game needs the generated silent placeholder video as its clock.
        video: videoUrl,
        // These fields aren't read by the actual instrument audio system
        // (useInstrumentAudio reads /songs/<id>/<stem>.mp3 directly), but
        // are kept here for reference/debugging.
        mp3Bass: bassUrl,
        mp3Drums: drumsUrl,
        mp3Other: otherUrl,
        local: true,
      };

      await SongDao.store(finalSong);
      await shareSong(finalSong.id);

      handleClose();
      navigate('edit/list/', { id: finalSong.id, created: 'true', song: null });
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <MenuWithLogo>
      <Helmet>
        <title>Manage Songs | AllKaraoke.Party - Free Online Karaoke Party Game</title>
      </Helmet>

      <Menu.Header>Manage Songs</Menu.Header>

      {setlist.isEditable && (
        <>
          <MenuButton {...register('add-song', () => setOpenAddSong(true))}>Create New Song</MenuButton>
        </>
      )}

      <hr />

      <SmoothLink to="menu/">
        <MenuButton {...register('back-button', goBack)}>Return To Main Menu</MenuButton>
      </SmoothLink>

      <Dialog open={openAddSong} onClose={handleClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
            Create New Song
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Paste a YouTube link and upload the UltraStar .txt lyrics file.
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {status === 'processing' ? (
            <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Separating stems…
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Downloading the audio and separating drums, bass, vocals, and everything else. This
                may take a few minutes.
              </Typography>
              <Box sx={{ width: '100%' }}>
                <LinearProgress />
              </Box>
            </Stack>
          ) : (
            <Stack spacing={2.5}>
              <TextField
                label="YouTube Link"
                placeholder="https://www.youtube.com/watch?v=..."
                fullWidth
                required
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                disabled={isBusy}
                data-test="youtube-url-input"
              />

              <FileDropzone
                label="Song Lyrics"
                hint="UltraStar .txt file"
                accept=".txt"
                file={txtFile}
                disabled={isBusy}
                onChange={setTxtFile}
              />

              {errorMsg && (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  <AlertTitle>Error</AlertTitle>
                  {errorMsg}
                </Alert>
              )}

              {status === 'uploading' && (
                <Box>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Uploading…
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {progress}%
                    </Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={progress} sx={{ borderRadius: 1, height: 6 }} />
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
          <Button onClick={handleClose} disabled={isBusy} color="inherit">
            Cancel
          </Button>

          <Button
            variant="contained"
            disabled={!youtubeUrl.trim() || !txtFile || isBusy}
            onClick={handleAddSong}
            sx={{ borderRadius: 2, px: 3 }}
          >
            {status === 'uploading' ? 'Uploading…' : 'Add Song'}
          </Button>
        </DialogActions>
      </Dialog>
    </MenuWithLogo>
  );
}

export default ManageSongs;