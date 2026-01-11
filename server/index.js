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

// Start server
app.listen(PORT, () => {
  console.log(`🎵 Playlist server running at http://localhost:${PORT}`);
});
