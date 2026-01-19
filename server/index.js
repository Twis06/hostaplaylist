const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, '..', 'data', 'playlists.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Helper functions
function readPlaylists() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]');
      return [];
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading playlists:', error);
    return [];
  }
}

function writePlaylists(playlists) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(playlists, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing playlists:', error);
    return false;
  }
}

// API Routes

// Get all playlists
app.get('/api/playlists', (req, res) => {
  const playlists = readPlaylists();
  res.json(playlists.map(p => ({
    id: p.id,
    name: p.name,
    songCount: p.songs.length,
    createdAt: p.createdAt
  })));
});

// Create new playlist
app.post('/api/playlists', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Playlist name is required' });
  }

  const playlists = readPlaylists();
  const newPlaylist = {
    id: uuidv4(),
    name: name.trim(),
    songs: [],
    createdAt: new Date().toISOString()
  };

  playlists.push(newPlaylist);
  writePlaylists(playlists);
  res.status(201).json(newPlaylist);
});

// Get single playlist
app.get('/api/playlists/:id', (req, res) => {
  const playlists = readPlaylists();
  const playlist = playlists.find(p => p.id === req.params.id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  res.json(playlist);
});

// Delete playlist
app.delete('/api/playlists/:id', (req, res) => {
  let playlists = readPlaylists();
  const index = playlists.findIndex(p => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  playlists.splice(index, 1);
  writePlaylists(playlists);
  res.json({ success: true });
});

// Add song to playlist
app.post('/api/playlists/:id/songs', (req, res) => {
  const { trackId, trackName, artistName, artworkUrl } = req.body;

  if (!trackName || !artistName) {
    return res.status(400).json({ error: 'Track name and artist are required' });
  }

  const playlists = readPlaylists();
  const playlist = playlists.find(p => p.id === req.params.id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  const song = {
    id: uuidv4(),
    trackId,
    trackName,
    artistName,
    artworkUrl,
    addedAt: new Date().toISOString()
  };

  playlist.songs.push(song);
  writePlaylists(playlists);
  res.status(201).json(song);
});

// Remove song from playlist
app.delete('/api/playlists/:id/songs/:songId', (req, res) => {
  const playlists = readPlaylists();
  const playlist = playlists.find(p => p.id === req.params.id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  const songIndex = playlist.songs.findIndex(s => s.id === req.params.songId);

  if (songIndex === -1) {
    return res.status(404).json({ error: 'Song not found' });
  }

  playlist.songs.splice(songIndex, 1);
  writePlaylists(playlists);
  res.json({ success: true });
});

// Export playlist as text
app.get('/api/playlists/:id/export', (req, res) => {
  const playlists = readPlaylists();
  const playlist = playlists.find(p => p.id === req.params.id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  const exportText = playlist.songs
    .map(song => `${song.artistName} - ${song.trackName}`)
    .join('\n');

  res.type('text/plain').send(exportText);
});

// Search songs via iTunes API
app.get('/api/search', async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=20`
    );
    const data = await response.json();

    const results = data.results.map(track => ({
      trackId: track.trackId,
      trackName: track.trackName,
      artistName: track.artistName,
      albumName: track.collectionName,
      artworkUrl: track.artworkUrl100?.replace('100x100', '200x200') || track.artworkUrl60
    }));

    res.json(results);
  } catch (error) {
    console.error('iTunes search error:', error);
    res.status(500).json({ error: 'Failed to search songs' });
  }
});

// Extract Spotify playlist ID from various URL formats
function extractSpotifyPlaylistId(input) {
  // Direct ID (22 characters alphanumeric)
  if (/^[a-zA-Z0-9]{22}$/.test(input)) {
    return input;
  }

  // URL formats:
  // https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
  // https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=xxxxx
  // spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
  const urlMatch = input.match(/playlist[/:]([a-zA-Z0-9]{22})/);
  if (urlMatch) {
    return urlMatch[1];
  }

  return null;
}

// Fetch Spotify playlist data
app.get('/api/spotify/playlist', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Spotify playlist URL is required' });
  }

  const playlistId = extractSpotifyPlaylistId(url.trim());

  if (!playlistId) {
    return res.status(400).json({ error: 'Invalid Spotify playlist URL' });
  }

  try {
    // Use Spotify's embed endpoint which is publicly accessible
    const response = await fetch(
      `https://open.spotify.com/embed/playlist/${playlistId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch playlist');
    }

    const html = await response.text();

    // Extract the embedded data from the script tag
    const dataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);

    if (!dataMatch) {
      // Try alternative: fetch from Spotify's internal API for embeds
      const embedResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}?market=US`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        }
      );

      if (embedResponse.ok) {
        const embedData = await embedResponse.json();
        // Process if accessible (usually needs auth)
      }

      throw new Error('Could not parse playlist data');
    }

    const jsonData = JSON.parse(dataMatch[1]);
    const playlistData = jsonData?.props?.pageProps?.state?.data?.entity;

    if (!playlistData) {
      throw new Error('Could not find playlist data');
    }

    const playlistName = playlistData.name || 'Spotify Playlist';
    const tracks = playlistData.trackList || [];

    const songs = tracks
      .filter(track => track.uri && track.title && track.subtitle)
      .map(track => ({
        trackId: track.uid || track.uri?.split(':').pop() || `spotify-${Date.now()}-${Math.random()}`,
        trackName: track.title,
        artistName: track.subtitle,
        artworkUrl: track.album?.images?.[0]?.url || track.images?.[0]?.url || null
      }));

    res.json({
      playlistName,
      songs,
      totalTracks: songs.length
    });
  } catch (error) {
    console.error('Spotify fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch Spotify playlist. Make sure the playlist is public.' });
  }
});

// Bulk add songs to playlist
app.post('/api/playlists/:id/songs/bulk', (req, res) => {
  const { songs } = req.body;

  if (!songs || !Array.isArray(songs) || songs.length === 0) {
    return res.status(400).json({ error: 'Songs array is required' });
  }

  const playlists = readPlaylists();
  const playlist = playlists.find(p => p.id === req.params.id);

  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  const addedSongs = songs.map(song => ({
    id: uuidv4(),
    trackId: song.trackId || `imported-${Date.now()}-${Math.random()}`,
    trackName: song.trackName,
    artistName: song.artistName,
    artworkUrl: song.artworkUrl || null,
    addedAt: new Date().toISOString()
  }));

  playlist.songs.push(...addedSongs);
  writePlaylists(playlists);

  res.status(201).json({
    added: addedSongs.length,
    songs: addedSongs
  });
});

// Extract Apple Music playlist ID from various URL formats
function extractAppleMusicPlaylistInfo(input) {
  // URL formats:
  // https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb
  // https://music.apple.com/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb
  // https://embed.music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb

  const urlMatch = input.match(/music\.apple\.com\/(?:([a-z]{2})\/)?(?:embed\/)?playlist\/[^/]+\/(pl\.[a-zA-Z0-9]+)/);
  if (urlMatch) {
    return {
      storefront: urlMatch[1] || 'us',
      playlistId: urlMatch[2]
    };
  }

  // Direct playlist ID (pl.xxxxx format)
  if (/^pl\.[a-zA-Z0-9]+$/.test(input)) {
    return {
      storefront: 'us',
      playlistId: input
    };
  }

  return null;
}

// Fetch Apple Music playlist data
app.get('/api/applemusic/playlist', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Apple Music playlist URL is required' });
  }

  const playlistInfo = extractAppleMusicPlaylistInfo(url.trim());

  if (!playlistInfo) {
    return res.status(400).json({ error: 'Invalid Apple Music playlist URL' });
  }

  try {
    // Use Apple Music's embed endpoint which is publicly accessible
    const response = await fetch(
      `https://embed.music.apple.com/${playlistInfo.storefront}/playlist/playlist/${playlistInfo.playlistId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch playlist');
    }

    const html = await response.text();

    // Try to extract JSON-LD data first (most reliable)
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">\s*(\{[\s\S]*?\})\s*<\/script>/);

    let playlistName = 'Apple Music Playlist';
    let songs = [];

    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        playlistName = jsonLd.name || playlistName;

        if (jsonLd.track && Array.isArray(jsonLd.track)) {
          songs = jsonLd.track.map(track => ({
            trackId: `apple-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            trackName: track.name,
            artistName: track.byArtist?.name || 'Unknown Artist',
            artworkUrl: null // Will be fetched from elsewhere if needed
          }));
        }
      } catch (e) {
        console.error('Failed to parse JSON-LD:', e);
      }
    }

    // Fallback: try to extract from the page's meta tags and data attributes
    if (songs.length === 0) {
      // Extract playlist name from title
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        playlistName = titleMatch[1].replace(' - Apple Music', '').replace(' on Apple Music', '').trim();
      }

      // Try to find track data in various data attributes or script tags
      const trackMatches = html.matchAll(/data-testid="track-title"[^>]*>([^<]+)</g);
      const artistMatches = html.matchAll(/data-testid="track-subtitle"[^>]*>([^<]+)</g);

      const tracks = [...trackMatches];
      const artists = [...artistMatches];

      if (tracks.length > 0) {
        for (let i = 0; i < tracks.length; i++) {
          songs.push({
            trackId: `apple-${Date.now()}-${i}`,
            trackName: tracks[i][1],
            artistName: artists[i]?.[1] || 'Unknown Artist',
            artworkUrl: null
          });
        }
      }
    }

    // Another fallback: look for serialized state data
    if (songs.length === 0) {
      const stateMatch = html.match(/<script id="serialized-server-data" type="application\/json">([^<]+)<\/script>/);
      if (stateMatch) {
        try {
          const stateData = JSON.parse(stateMatch[1]);
          // Navigate through the structure to find tracks
          const findTracks = (obj, depth = 0) => {
            if (depth > 10) return [];
            if (!obj || typeof obj !== 'object') return [];

            if (Array.isArray(obj)) {
              return obj.flatMap(item => findTracks(item, depth + 1));
            }

            if (obj.type === 'songs' && obj.attributes) {
              return [{
                trackId: obj.id || `apple-${Date.now()}-${Math.random()}`,
                trackName: obj.attributes.name,
                artistName: obj.attributes.artistName,
                artworkUrl: obj.attributes.artwork?.url?.replace('{w}', '200').replace('{h}', '200') || null
              }];
            }

            return Object.values(obj).flatMap(val => findTracks(val, depth + 1));
          };

          songs = findTracks(stateData);
        } catch (e) {
          console.error('Failed to parse state data:', e);
        }
      }
    }

    if (songs.length === 0) {
      throw new Error('Could not find any songs in this playlist. Please make sure the playlist is public.');
    }

    res.json({
      playlistName,
      songs,
      totalTracks: songs.length
    });
  } catch (error) {
    console.error('Apple Music fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch Apple Music playlist. Make sure the playlist is public.' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🎵 Playlist server running at http://localhost:${PORT}`);
});
