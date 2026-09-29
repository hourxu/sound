import { Alert, AlertTitle, Button, Grid, LinearProgress, Paper, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { Song } from '~/interfaces';
import SongDao from '~/modules/Songs/SongsService';
import convertTxtToSong from '~/modules/Songs/utils/convertTxtToSong';
import getSongId from '~/modules/Songs/utils/getSongId';
import useSmoothNavigate from '~/modules/hooks/useSmoothNavigate';
import { shareSong } from '~/routes/Edit/ShareSongsModal';

const ACCEPTED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/mp4', 'audio/ogg'];
const MAX_AUDIO_SIZE_MB = 100;

type Status = 'idle' | 'uploading' | 'processing' | 'error';

interface StemUrls {
  mp3: string;
  mp3Bass: string;
  mp3Drums: string;
  mp3Other: string;
}

export default function Addsong() {
  const navigate = useSmoothNavigate();

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [txtInput, setTxtInput] = useState('');
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [authorUrl, setAuthorUrl] = useState('');

  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

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
  };

  // TODO: point this at the real Demucs backend once it exists.
  // Expected contract: POST /api/songs/separate (multipart: file) ->
  // { mp3, mp3Bass, mp3Drums, mp3Other } URLs where the separated (and
  // original/instrumental) audio has been hosted and is publicly fetchable,
  // since SongsService persists these as plain URL strings on the Song.
  const uploadAndSeparate = (file: File): Promise<StemUrls> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/songs/separate');

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

  const isFormComplete = !!audioFile && !!txtInput.trim() && !!title.trim() && !!artist.trim();

  const handleSubmit = async () => {
    if (!audioFile) {
      setErrorMsg('Please choose an audio file.');
      return;
    }
    if (!txtInput.trim()) {
      setErrorMsg('Please paste the UltraStar .txt lyrics/notes.');
      return;
    }

    setErrorMsg('');

    // Parse lyrics/notes first, fully client-side, same as Convert does.
    // No video URL here since this flow has no YouTube step — passing ''
    // means fields that would come from a video (e.g. video id) stay empty.
    let parsedSong: Song;
    try {
      parsedSong = convertTxtToSong(txtInput, '', author.trim(), authorUrl.trim(), undefined);
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
      navigate('edit/list/', { id: finalSong.id, created: 'true', song: null });
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  const isBusy = status === 'uploading' || status === 'processing';

  return (
    <Grid container gap={2} p={1} pt={0} pb={10}>
      <Grid item xs={12}>
        <Paper sx={{ padding: 4, maxWidth: 800, margin: '2rem auto' }}>
          <Typography variant="h4" gutterBottom>
            Create New Song
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Upload your own audio file and paste the UltraStar .txt lyrics/notes. We will separate the
            instruments and create a playable song.
          </Typography>

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
                <Typography variant="subtitle1" sx={{ mt: 1 }}>
                  Audio file
                </Typography> 
               <input
                type="file"
                accept="audio/*"
                disabled={isBusy}
                onChange={(event) => handleAudioChange(event.target.files?.[0] ?? null)}
                data-test="audio-file-input"
              />
              {audioFile && (
                <Typography sx={{ mt: 1 }}>
                  Selected: {audioFile.name} ({(audioFile.size / (1024 * 1024)).toFixed(1)} MB)
                </Typography>
              )}

              <TextField
                label="UltraStar .txt content"
                placeholder="Paste the full contents of the .txt file here"
                fullWidth
                required
                multiline
                minRows={6}
                value={txtInput}
                onChange={(e) => setTxtInput(e.target.value)}
                disabled={isBusy}
                sx={{ mt: 3 }}
                data-test="txt-input"
              /> 

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

              <Button
                variant="contained"
                sx={{ mt: 3 }}
                disabled={!isFormComplete || isBusy}
                onClick={handleSubmit}
                data-test="create-song-button"
              >
                {status === 'uploading' ? 'Uploading…' : 'Create Song'}
              </Button>
            </>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
}