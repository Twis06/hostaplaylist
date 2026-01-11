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
    playlistsGrid.innerHTML = playlists.map(playlist => `
    <div class="playlist-card" data-id="${playlist.id}">
      <h3>${escapeHtml(playlist.name)}</h3>
      <span class="song-count">${playlist.songCount} song${playlist.songCount !== 1 ? 's' : ''}</span>
    </div>
  `).join('');
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
});
