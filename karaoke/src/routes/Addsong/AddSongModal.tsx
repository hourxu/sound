import {
  Alert,
  AlertTitle,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Song } from '~/interfaces';
import SongDao from '~/modules/Songs/SongsService';
import convertTxtToSong from '~/modules/Songs/utils/convertTxtToSong';
import getSongId from '~/modules/Songs/utils/getSongId';
import useSmoothNavigate from '~/modules/hooks/useSmoothNavigate';
import { shareSong } from '~/routes/Edit/ShareSongsModal';

const ACCEPTED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/mp4', 'audio/ogg'];
const MAX_AUDIO_SIZE_MB = 100;

// Point this at wherever the Demucs backend actually runs.
const SEPARATE_ENDPOINT = 'http://localhost:8000/api/songs/separate';

type Status = 'idle' | 'uploading' | 'processing' | 'error';

interface StemUrls {
  mp3: string;
  mp3Bass: string;
  mp3Drums: string;
  mp3Other: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddSongModal({ open, onClose }: Props) {
  const navigate = useSmoothNavigate();

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [txtFile, setTxtFile] = useState<File | null>(null);
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [authorUrl, setAuthorUrl] = useState('');

  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const isBusy = status === 'uploading' || status === 'processing';

  const resetForm = () => {
    setAudioFile(null);
    setTxtFile(null);
    setArtist('');
    setTitle('');
    setAuthor('');
    setAuthorUrl('');
    setStatus('idle');
    setProgress(0);
    setErrorMsg('');
  };

  const handleClose = () => {
    if (isBusy) return; // don't allow closing mid-upload/processing
    resetForm();
    onClose();
  };

  const handleAudioChange = (selected: File | null) => {
    setErrorMsg('');
    if (!selected) {
      setAudioFile(null);
      return;
    }
    if (!ACCEPTED_AUDIO_TYPES.includes(selected.type)) {
      setErrorMsg('Unsupported audio type. Please use MP3, WAV, FLAC, M4A, or OGG.');
      return;
    }
    if (selected.size > MAX_AUDIO_SIZE_MB * 1024 * 1024) {
      setErrorMsg(`Audio file is too large. Max size is ${MAX_AUDIO_SIZE_MB}MB.`);
      return;
    }
    setAudioFile(selected);
    if (!title) {
      setTitle(selected.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleTxtChange = (selected: File | null) => {
    setErrorMsg('');
    if (!selected) {
      setTxtFile(null);
      return;
    }
    if (!selected.name.toLowerCase().endsWith('.txt')) {
      setErrorMsg('Please choose a .txt file (UltraStar format).');
      return;
    }
    setTxtFile(selected);
  };

  const readFileAsText = (fileToRead: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Could not read the .txt file.'));
      reader.readAsText(fileToRead);
    });
  };

  const uploadAndSeparate = (file: File): Promise<StemUrls> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

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
          reject(new Error(`Separation request failed (${xhr.status}).`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error while uploading audio.'));
      xhr.send(formData);
    });
  };

  const isFormComplete = !!audioFile && !!txtFile && !!title.trim() && !!artist.trim();

  const handleSubmit = async () => {
    if (!audioFile) {
      setErrorMsg('Please choose an audio file.');
      return;
    }
    if (!txtFile) {
      setErrorMsg('Please choose the UltraStar .txt lyrics file.');
      return;
    }

    setErrorMsg('');

    let parsedSong: Song;
    try {
      const txtContent = await readFileAsText(txtFile);
      parsedSong = convertTxtToSong(txtContent, '', author.trim(), authorUrl.trim(), undefined);
    } catch (e) {
      console.error(e);
      setErrorMsg('Could not parse the .txt file. Please check the format and try again.');
      return;
    }

    setStatus('uploading');
    setProgress(0);

    try {
      const stems = await uploadAndSeparate(audioFile);
      setStatus('processing');

      const finalSong: Song = {
        ...parsedSong,
        artist: artist.trim(),
        title: title.trim(),
        author: author.trim() || undefined,
        authorUrl: authorUrl.trim() || undefined,
        mp3: stems.mp3,
        mp3Bass: stems.mp3Bass,
        mp3Drums: stems.mp3Drums,
        mp3Other: stems.mp3Other,
        id: getSongId({ artist: artist.trim(), title: title.trim() }),
        local: true,
      };

      await SongDao.store(finalSong);
      await shareSong(finalSong.id);
      resetForm();
      onClose();
      navigate('edit/list/', { id: finalSong.id, created: 'true', song: null });
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Song</DialogTitle>
      <DialogContent>
        {status === 'processing' ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Separating stems (drums, vocals, bass, other)…
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This can take a minute or two depending on song length.
            </Typography>
            <LinearProgress />
          </div>
        ) : (
          <>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Upload your own audio file and its UltraStar .txt lyrics file. We will separate the
              instruments and create a playable song.
            </Typography>

            <Typography variant="subtitle2">Audio file</Typography>
            <input
              type="file"
              accept="audio/*"
              disabled={isBusy}
              onChange={(event) => handleAudioChange(event.target.files?.[0] ?? null)}
              data-test="audio-file-input"
            />
            {audioFile && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Selected: {audioFile.name} ({(audioFile.size / (1024 * 1024)).toFixed(1)} MB)
              </Typography>
            )}

            <Typography variant="subtitle2" sx={{ mt: 3 }}>
              Lyrics (.txt file)
            </Typography>
            <input
              type="file"
              accept=".txt,text/plain"
              disabled={isBusy}
              onChange={(event) => handleTxtChange(event.target.files?.[0] ?? null)}
              data-test="txt-file-input"
            />
            {txtFile && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Selected: {txtFile.name}
              </Typography>
            )}

            <TextField
              label="Title"
              fullWidth
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isBusy}
              sx={{ mt: 3 }}
              data-test="title-input"
            />

            <TextField
              label="Artist"
              fullWidth
              required
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              disabled={isBusy}
              sx={{ mt: 2 }}
              data-test="artist-input"
            />

            <TextField
              label="Author (optional, credit for the .txt/notes)"
              fullWidth
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              disabled={isBusy}
              sx={{ mt: 2 }}
            />

            <TextField
              label="Author URL (optional)"
              fullWidth
              value={authorUrl}
              onChange={(e) => setAuthorUrl(e.target.value)}
              disabled={isBusy}
              sx={{ mt: 2 }}
            />

            {errorMsg && (
              <Alert severity="error" sx={{ mt: 3 }} data-test="add-song-error">
                <AlertTitle>Error</AlertTitle>
                {errorMsg}
              </Alert>
            )}

            {status === 'uploading' && (
              <div style={{ marginTop: '1rem' }}>
                <LinearProgress variant="determinate" value={progress} />
                <Typography variant="caption">{progress}%</Typography>
              </div>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isBusy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!isFormComplete || isBusy}
          onClick={handleSubmit}
          data-test="create-song-button"
        >
          {status === 'uploading' ? 'Uploading…' : 'Create Song'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}