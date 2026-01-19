// State
let currentPlaylistId = null;

// DOM Elements
const playlistsView = document.getElementById('playlists-view');
const playlistView = document.getElementById('playlist-view');
const playlistsGrid = document.getElementById('playlists-grid');
const emptyState = document.getElementById('empty-state');
const songsList = document.getElementById('songs-list');
const songsEmpty = document.getElementById('songs-empty');
const playlistTitle = document.getElementById('playlist-title');
const playlistCount = document.getElementById('playlist-count');

// Modals
const newPlaylistModal = document.getElementById('new-playlist-modal');
const searchModal = document.getElementById('search-modal');
const exportModal = document.getElementById('export-modal');

// API Helper
async function api(url, options = {}) {
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Something went wrong');
    }
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
        return response.json();
    }
    return response.text();
}

// Toast
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 2500);
}

// Playlists View
async function loadPlaylists() {
    try {
        const playlists = await api('/api/playlists');
        renderPlaylists(playlists);
    } catch (error) {
        showToast('Failed to load playlists');
    }
}

function renderPlaylists(playlists) {
    if (playlists.length === 0) {
        playlistsGrid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    playlistsGrid.innerHTML = playlists.map(playlist => {
        const date = new Date(playlist.createdAt);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        return `
    <div class="playlist-card" data-id="${playlist.id}">
      <div class="card-content">
        <div class="card-back">
          <div class="back-content">
            <div class="count-number">${playlist.songCount}</div>
            <div class="count-label">Song${playlist.songCount !== 1 ? 's' : ''}</div>
            <div class="date-info">${dateStr}</div>
          </div>
        </div>
        <div class="card-front">
          <div class="front-content">
            <h3 class="card-title">${escapeHtml(playlist.name)}</h3>
          </div>
          <div class="circle-deco circle-1"></div>
          <div class="circle-deco circle-2"></div>
        </div>
      </div>
    </div>
  `}).join('');
}

// Playlist View
async function loadPlaylist(id) {
    try {
        const playlist = await api(`/api/playlists/${id}`);
        currentPlaylistId = id;
        renderPlaylist(playlist);
        showView('playlist');
    } catch (error) {
        showToast('Failed to load playlist');
    }
}

function renderPlaylist(playlist) {
    playlistTitle.textContent = playlist.name;
    playlistCount.textContent = `${playlist.songs.length} song${playlist.songs.length !== 1 ? 's' : ''}`;

    if (playlist.songs.length === 0) {
        songsList.innerHTML = '';
        songsEmpty.style.display = 'block';
        return;
    }

    songsEmpty.style.display = 'none';
    songsList.innerHTML = playlist.songs.map(song => `
    <div class="song-item" data-id="${song.id}">
      <img class="song-artwork" src="${song.artworkUrl || ''}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 48%22><rect fill=%22%23f5f5f7%22 width=%2248%22 height=%2248%22/><text x=%2224%22 y=%2228%22 text-anchor=%22middle%22 fill=%22%2386868b%22 font-size=%2220%22>🎵</text></svg>'">
      <div class="song-info">
        <div class="song-title">${escapeHtml(song.trackName)}</div>
        <div class="song-artist">${escapeHtml(song.artistName)}</div>
      </div>
      <button class="song-remove" data-song-id="${song.id}">×</button>
    </div>
  `).join('');
}

// View Switching
function showView(view) {
    if (view === 'playlists') {
        playlistsView.style.display = 'block';
        playlistView.style.display = 'none';
        currentPlaylistId = null;
    } else {
        playlistsView.style.display = 'none';
        playlistView.style.display = 'block';
    }
}

// Modal Helpers
function showModal(modal) {
    modal.style.display = 'flex';
}

function hideModal(modal) {
    modal.style.display = 'none';
}

// Search
let searchTimeout = null;

async function searchSongs(query) {
    const results = document.getElementById('search-results');
    const loading = document.getElementById('search-loading');
    const empty = document.getElementById('search-empty');

    if (!query.trim()) {
        results.innerHTML = '';
        empty.style.display = 'none';
        return;
    }

    loading.style.display = 'flex';
    results.innerHTML = '';
    empty.style.display = 'none';

    try {
        const songs = await api(`/api/search?q=${encodeURIComponent(query)}`);
        loading.style.display = 'none';

        if (songs.length === 0) {
            empty.style.display = 'block';
            return;
        }

        results.innerHTML = songs.map(song => `
      <div class="search-item" data-track='${JSON.stringify(song).replace(/'/g, "&apos;")}'>
        <img class="search-artwork" src="${song.artworkUrl || ''}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 44 44%22><rect fill=%22%23f5f5f7%22 width=%2244%22 height=%2244%22/><text x=%2222%22 y=%2226%22 text-anchor=%22middle%22 fill=%22%2386868b%22 font-size=%2216%22>🎵</text></svg>'">
        <div class="search-info">
          <div class="search-title">${escapeHtml(song.trackName)}</div>
          <div class="search-meta">${escapeHtml(song.artistName)} · ${escapeHtml(song.albumName || '')}</div>
        </div>
        <span class="search-add">+</span>
      </div>
    `).join('');
    } catch (error) {
        loading.style.display = 'none';
        showToast('Search failed');
    }
}

// Utility
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadPlaylists();

    // Playlist card click
    playlistsGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.playlist-card');
        if (card) {
            loadPlaylist(card.dataset.id);
        }
    });

    // Back button
    document.getElementById('back-btn').addEventListener('click', () => {
        showView('playlists');
        loadPlaylists();
    });

    // New playlist modal
    document.getElementById('new-playlist-btn').addEventListener('click', () => {
        document.getElementById('playlist-name-input').value = '';
        showModal(newPlaylistModal);
        document.getElementById('playlist-name-input').focus();
    });

    document.getElementById('cancel-playlist-btn').addEventListener('click', () => {
        hideModal(newPlaylistModal);
    });

    document.getElementById('create-playlist-btn').addEventListener('click', async () => {
        const name = document.getElementById('playlist-name-input').value.trim();
        if (!name) return;

        try {
            await api('/api/playlists', { method: 'POST', body: { name } });
            hideModal(newPlaylistModal);
            loadPlaylists();
            showToast('Playlist created');
        } catch (error) {
            showToast(error.message);
        }
    });

    document.getElementById('playlist-name-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('create-playlist-btn').click();
        }
    });

    // Delete playlist
    document.getElementById('delete-playlist-btn').addEventListener('click', async () => {
        if (!confirm('Delete this playlist?')) return;

        try {
            await api(`/api/playlists/${currentPlaylistId}`, { method: 'DELETE' });
            showView('playlists');
            loadPlaylists();
            showToast('Playlist deleted');
        } catch (error) {
            showToast(error.message);
        }
    });

    // Add song modal
    document.getElementById('add-song-btn').addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        document.getElementById('search-results').innerHTML = '';
        document.getElementById('search-empty').style.display = 'none';
        showModal(searchModal);
        document.getElementById('search-input').focus();
    });

    document.getElementById('close-search-btn').addEventListener('click', () => {
        hideModal(searchModal);
    });

    // Search input
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchSongs(e.target.value);
        }, 300);
    });

    // Add song from search
    document.getElementById('search-results').addEventListener('click', async (e) => {
        const item = e.target.closest('.search-item');
        if (!item) return;

        try {
            const track = JSON.parse(item.dataset.track);
            await api(`/api/playlists/${currentPlaylistId}/songs`, {
                method: 'POST',
                body: {
                    trackId: track.trackId,
                    trackName: track.trackName,
                    artistName: track.artistName,
                    artworkUrl: track.artworkUrl
                }
            });
            hideModal(searchModal);
            loadPlaylist(currentPlaylistId);
            showToast('Song added');
        } catch (error) {
            showToast(error.message);
        }
    });

    // Remove song
    songsList.addEventListener('click', async (e) => {
        const btn = e.target.closest('.song-remove');
        if (!btn) return;

        try {
            await api(`/api/playlists/${currentPlaylistId}/songs/${btn.dataset.songId}`, {
                method: 'DELETE'
            });
            loadPlaylist(currentPlaylistId);
            showToast('Song removed');
        } catch (error) {
            showToast(error.message);
        }
    });

    // Export
    document.getElementById('export-btn').addEventListener('click', async () => {
        try {
            const text = await api(`/api/playlists/${currentPlaylistId}/export`);
            document.getElementById('export-text').value = text || 'Playlist is empty';
            showModal(exportModal);
        } catch (error) {
            showToast(error.message);
        }
    });

    document.getElementById('close-export-btn').addEventListener('click', () => {
        hideModal(exportModal);
    });

    document.getElementById('copy-export-btn').addEventListener('click', async () => {
        const text = document.getElementById('export-text').value;
        try {
            await navigator.clipboard.writeText(text);
            showToast('Copied to clipboard');
        } catch {
            showToast('Failed to copy');
        }
    });

    // Modal backdrop clicks
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            hideModal(backdrop.closest('.modal'));
        });
    });

    // ============================================
    // SPOTIFY IMPORT FUNCTIONALITY
    // ============================================

    const spotifyModal = document.getElementById('spotify-modal');
    const spotifyUrlInput = document.getElementById('spotify-url-input');
    const spotifyStatus = document.getElementById('spotify-status');
    const spotifyStatusText = document.getElementById('spotify-status-text');
    const spotifyPreview = document.getElementById('spotify-preview');
    const importSpotifyBtn = document.getElementById('import-spotify-btn');

    let spotifyPlaylistData = null;

    // Open Spotify import modal
    document.getElementById('spotify-import-btn').addEventListener('click', () => {
        spotifyUrlInput.value = '';
        spotifyStatus.style.display = 'none';
        spotifyStatus.className = 'spotify-status';
        spotifyPreview.style.display = 'none';
        importSpotifyBtn.disabled = true;
        spotifyPlaylistData = null;
        showModal(spotifyModal);
        spotifyUrlInput.focus();
    });

    // Close Spotify modal
    document.getElementById('close-spotify-btn').addEventListener('click', () => {
        hideModal(spotifyModal);
    });

    // Fetch Spotify playlist when URL is pasted
    let spotifyFetchTimeout = null;
    spotifyUrlInput.addEventListener('input', () => {
        clearTimeout(spotifyFetchTimeout);
        const url = spotifyUrlInput.value.trim();

        if (!url) {
            spotifyStatus.style.display = 'none';
            spotifyPreview.style.display = 'none';
            importSpotifyBtn.disabled = true;
            spotifyPlaylistData = null;
            return;
        }

        // Check if it looks like a Spotify URL
        if (url.includes('spotify.com/playlist') || url.includes('spotify:playlist:') || /^[a-zA-Z0-9]{22}$/.test(url)) {
            spotifyFetchTimeout = setTimeout(() => fetchSpotifyPlaylist(url), 500);
        }
    });

    // Also trigger on paste
    spotifyUrlInput.addEventListener('paste', (e) => {
        setTimeout(() => {
            const url = spotifyUrlInput.value.trim();
            if (url.includes('spotify.com/playlist') || url.includes('spotify:playlist:') || /^[a-zA-Z0-9]{22}$/.test(url)) {
                fetchSpotifyPlaylist(url);
            }
        }, 100);
    });

    async function fetchSpotifyPlaylist(url) {
        spotifyStatus.style.display = 'block';
        spotifyStatus.className = 'spotify-status';
        spotifyStatusText.textContent = 'Fetching playlist...';
        spotifyStatus.querySelector('.spinner').style.display = 'block';
        spotifyPreview.style.display = 'none';
        importSpotifyBtn.disabled = true;
        spotifyPlaylistData = null;

        try {
            const data = await api(`/api/spotify/playlist?url=${encodeURIComponent(url)}`);

            if (data.songs && data.songs.length > 0) {
                spotifyPlaylistData = data;

                // Show success status
                spotifyStatus.className = 'spotify-status success';
                spotifyStatus.querySelector('.spinner').style.display = 'none';
                spotifyStatusText.textContent = `Found ${data.songs.length} songs!`;

                // Show preview
                showSpotifyPreview(data);
                importSpotifyBtn.disabled = false;
            } else {
                throw new Error('No songs found in playlist');
            }
        } catch (error) {
            spotifyStatus.className = 'spotify-status error';
            spotifyStatus.querySelector('.spinner').style.display = 'none';
            spotifyStatusText.textContent = error.message || 'Failed to fetch playlist';
            spotifyPreview.style.display = 'none';
            importSpotifyBtn.disabled = true;
        }
    }

    function showSpotifyPreview(data) {
        document.getElementById('preview-playlist-name').textContent = data.playlistName;
        document.getElementById('preview-song-count').textContent = `${data.songs.length} songs`;

        const previewSongs = document.getElementById('preview-songs');
        const displaySongs = data.songs.slice(0, 50); // Show max 50 songs in preview

        previewSongs.innerHTML = displaySongs.map((song, index) => `
            <div class="preview-song-item">
                <span class="preview-song-number">${index + 1}</span>
                <div class="preview-song-info">
                    <div class="preview-song-title">${escapeHtml(song.trackName)}</div>
                    <div class="preview-song-artist">${escapeHtml(song.artistName)}</div>
                </div>
            </div>
        `).join('');

        if (data.songs.length > 50) {
            previewSongs.innerHTML += `
                <div class="preview-song-item" style="justify-content: center; color: var(--text-secondary);">
                    ... and ${data.songs.length - 50} more songs
                </div>
            `;
        }

        spotifyPreview.style.display = 'block';
    }

    // Import songs from Spotify
    importSpotifyBtn.addEventListener('click', async () => {
        if (!spotifyPlaylistData || !spotifyPlaylistData.songs.length) return;

        importSpotifyBtn.disabled = true;
        spotifyStatus.className = 'spotify-status';
        spotifyStatus.querySelector('.spinner').style.display = 'block';
        spotifyStatusText.textContent = 'Importing songs...';

        try {
            const result = await api(`/api/playlists/${currentPlaylistId}/songs/bulk`, {
                method: 'POST',
                body: { songs: spotifyPlaylistData.songs }
            });

            hideModal(spotifyModal);
            loadPlaylist(currentPlaylistId);
            showToast(`Added ${result.added} songs from Spotify!`);
        } catch (error) {
            spotifyStatus.className = 'spotify-status error';
            spotifyStatus.querySelector('.spinner').style.display = 'none';
            spotifyStatusText.textContent = error.message || 'Failed to import songs';
            importSpotifyBtn.disabled = false;
        }
    });

    // ============================================
    // APPLE MUSIC IMPORT FUNCTIONALITY
    // ============================================

    const appleModal = document.getElementById('apple-modal');
    const appleUrlInput = document.getElementById('apple-url-input');
    const appleStatus = document.getElementById('apple-status');
    const appleStatusText = document.getElementById('apple-status-text');
    const applePreview = document.getElementById('apple-preview');
    const importAppleBtn = document.getElementById('import-apple-btn');

    let applePlaylistData = null;

    // Open Apple Music import modal
    document.getElementById('apple-import-btn').addEventListener('click', () => {
        appleUrlInput.value = '';
        appleStatus.style.display = 'none';
        appleStatus.className = 'apple-status';
        applePreview.style.display = 'none';
        importAppleBtn.disabled = true;
        applePlaylistData = null;
        showModal(appleModal);
        appleUrlInput.focus();
    });

    // Close Apple Music modal
    document.getElementById('close-apple-btn').addEventListener('click', () => {
        hideModal(appleModal);
    });

    // Fetch Apple Music playlist when URL is pasted
    let appleFetchTimeout = null;
    appleUrlInput.addEventListener('input', () => {
        clearTimeout(appleFetchTimeout);
        const url = appleUrlInput.value.trim();

        if (!url) {
            appleStatus.style.display = 'none';
            applePreview.style.display = 'none';
            importAppleBtn.disabled = true;
            applePlaylistData = null;
            return;
        }

        // Check if it looks like an Apple Music URL
        if (url.includes('music.apple.com') && url.includes('playlist')) {
            appleFetchTimeout = setTimeout(() => fetchAppleMusicPlaylist(url), 500);
        }
    });

    // Also trigger on paste
    appleUrlInput.addEventListener('paste', (e) => {
        setTimeout(() => {
            const url = appleUrlInput.value.trim();
            if (url.includes('music.apple.com') && url.includes('playlist')) {
                fetchAppleMusicPlaylist(url);
            }
        }, 100);
    });

    async function fetchAppleMusicPlaylist(url) {
        appleStatus.style.display = 'block';
        appleStatus.className = 'apple-status';
        appleStatusText.textContent = 'Fetching playlist...';
        appleStatus.querySelector('.spinner').style.display = 'block';
        applePreview.style.display = 'none';
        importAppleBtn.disabled = true;
        applePlaylistData = null;

        try {
            const data = await api(`/api/applemusic/playlist?url=${encodeURIComponent(url)}`);

            if (data.songs && data.songs.length > 0) {
                applePlaylistData = data;

                // Show success status
                appleStatus.className = 'apple-status success';
                appleStatus.querySelector('.spinner').style.display = 'none';
                appleStatusText.textContent = `Found ${data.songs.length} songs!`;

                // Show preview
                showApplePreview(data);
                importAppleBtn.disabled = false;
            } else {
                throw new Error('No songs found in playlist');
            }
        } catch (error) {
            appleStatus.className = 'apple-status error';
            appleStatus.querySelector('.spinner').style.display = 'none';
            appleStatusText.textContent = error.message || 'Failed to fetch playlist';
            applePreview.style.display = 'none';
            importAppleBtn.disabled = true;
        }
    }

    function showApplePreview(data) {
        document.getElementById('apple-preview-playlist-name').textContent = data.playlistName;
        document.getElementById('apple-preview-song-count').textContent = `${data.songs.length} songs`;

        const previewSongs = document.getElementById('apple-preview-songs');
        const displaySongs = data.songs.slice(0, 50); // Show max 50 songs in preview

        previewSongs.innerHTML = displaySongs.map((song, index) => `
            <div class="preview-song-item">
                <span class="preview-song-number">${index + 1}</span>
                <div class="preview-song-info">
                    <div class="preview-song-title">${escapeHtml(song.trackName)}</div>
                    <div class="preview-song-artist">${escapeHtml(song.artistName)}</div>
                </div>
            </div>
        `).join('');

        if (data.songs.length > 50) {
            previewSongs.innerHTML += `
                <div class="preview-song-item" style="justify-content: center; color: var(--text-secondary);">
                    ... and ${data.songs.length - 50} more songs
                </div>
            `;
        }

        applePreview.style.display = 'block';
    }

    // Import songs from Apple Music
    importAppleBtn.addEventListener('click', async () => {
        if (!applePlaylistData || !applePlaylistData.songs.length) return;

        importAppleBtn.disabled = true;
        appleStatus.className = 'apple-status';
        appleStatus.querySelector('.spinner').style.display = 'block';
        appleStatusText.textContent = 'Importing songs...';

        try {
            const result = await api(`/api/playlists/${currentPlaylistId}/songs/bulk`, {
                method: 'POST',
                body: { songs: applePlaylistData.songs }
            });

            hideModal(appleModal);
            loadPlaylist(currentPlaylistId);
            showToast(`Added ${result.added} songs from Apple Music!`);
        } catch (error) {
            appleStatus.className = 'apple-status error';
            appleStatus.querySelector('.spinner').style.display = 'none';
            appleStatusText.textContent = error.message || 'Failed to import songs';
            importAppleBtn.disabled = false;
        }
    });
});
