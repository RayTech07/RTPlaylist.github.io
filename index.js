const playlist = [];

const playlists = [
  {
    id: "default",
    name: "My playlist",
    trackIds: []
  }
];

let currentId = null;
let shuffle = false;
let repeat = false;
let view = "all";
let activePlaylistId = "default";
let toastTimer;
let objectUrls = [];
let darkTheme = true;

const $ = id => document.getElementById(id);
const audio = $("audio");
const fileInput = $("fileInput");

const colors = [
  "linear-gradient(135deg,#ff9a76,#b45dff)",
  "linear-gradient(135deg,#42d6c5,#3677dc)",
  "linear-gradient(135deg,#f7c66b,#ed6c9a)",
  "linear-gradient(135deg,#7c83ff,#43c5e7)",
  "linear-gradient(135deg,#f28a5f,#e54d77)"
];

const icons = ["♫", "♪", "♬", "♩", "𝄞"];

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================

function toast(message) {
  $("toast").textContent = message;
  $("toast").style.display = "block";

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    $("toast").style.display = "none";
  }, 2600);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${remainingSeconds}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function currentTrack() {
  return playlist.find(track => track.id === currentId) || null;
}

function activePlaylist() {
  return playlists.find(item => item.id === activePlaylistId) || playlists[0];
}

function tracksForActivePlaylist() {
  const ids = new Set(activePlaylist().trackIds);

  return playlist.filter(track => ids.has(track.id));
}

function visibleTracks() {
  const query = $("search").value.trim().toLowerCase();

  let result = tracksForActivePlaylist().filter(track => {
    const text = `${track.title} ${track.artist}`.toLowerCase();

    const matchesSearch = text.includes(query);
    const matchesLiked = view !== "liked" || track.liked;

    return matchesSearch && matchesLiked;
  });

  if (view === "recent") {
    result = result.slice().reverse();
  }

  return result;
}

// ==========================================
// 3. DISPLAY PLAYLISTS
// ==========================================

function renderPlaylistOptions() {
  const select = $("playlistSelect");
  select.innerHTML = "";

  playlists.forEach(item => {
    const option = document.createElement("option");

    option.value = item.id;
    option.textContent = item.name;
    option.selected = item.id === activePlaylistId;

    select.appendChild(option);
  });
}

function render() {
  const tracks = visibleTracks();
  const rows = $("trackRows");

  rows.innerHTML = "";

  $("emptyState").style.display = tracks.length ? "none" : "block";

  $("listHeading").textContent =
    view === "liked" ? "Liked songs" :
    view === "recent" ? "Recently added" :
    activePlaylist().name;

  $("listSub").textContent =
    `${tracks.length} of ${tracksForActivePlaylist().length} tracks shown`;

  $("songCount").textContent =
    `${playlist.length} ${playlist.length === 1 ? "track" : "tracks"}`;

  const totalDuration = playlist.reduce(
    (sum, track) => sum + (track.duration || 0), 0
  );

  $("totalTime").textContent =
    `${Math.round(totalDuration / 60)} min total`;

  renderPlaylistOptions();

  tracks.forEach((track, index) => {
    const actualIndex = playlist.findIndex(item => item.id === track.id);

    const row = document.createElement("tr");

    if (track.id === currentId) {
      row.classList.add("current");
    }

    const number =
      track.id === currentId && !audio.paused
        ? "♫"
        : String(actualIndex + 1);

    row.innerHTML = `
      <td>${number}</td>

      <td>
        <div class="track-cell">
          <div class="cover"
            style="background:${colors[actualIndex % colors.length]}">
            ${icons[actualIndex % icons.length]}
          </div>

          <div style="min-width:0">
            <div class="track-title"
              title="${escapeHtml(track.title)}">
              ${escapeHtml(track.title)}
            </div>

            <div class="track-sub">
              ${escapeHtml(track.artist)}
            </div>
          </div>
        </div>
      </td>

      <td>${escapeHtml(track.addedAt)}</td>
      <td>${formatTime(track.duration)}</td>

      <td>
        <div class="row-actions">
          <button class="icon-btn"
            data-action="play" data-id="${track.id}"
            title="Play">▶</button>

          <button class="icon-btn"
            data-action="edit" data-id="${track.id}"
            title="Edit song">✎</button>

          <button class="icon-btn"
            data-action="like" data-id="${track.id}"
            title="Like song">
            ${track.liked ? "♥" : "♡"}
          </button>

          <button class="icon-btn"
            data-action="remove" data-id="${track.id}"
            title="Remove song">×</button>
        </div>
      </td>
    `;

    rows.appendChild(row);
  });

  const track = currentTrack();

  if (track) {
    $("nowTitle").textContent = track.title;
    $("nowArtist").textContent = track.artist;

    const index = playlist.findIndex(item => item.id === track.id);

    $("nowCover").style.background = colors[index % colors.length];
    $("nowCover").textContent = icons[index % icons.length];

    $("likeCurrent").textContent = track.liked ? "♥" : "♡";
  } else {
    $("nowTitle").textContent = "Nothing playing";
    $("nowArtist").textContent = "Choose a track to begin";
    $("nowCover").textContent = "♫";
    $("likeCurrent").textContent = "♡";
  }

  $("playBtn").textContent = audio.paused ? "▶" : "Ⅱ";

  $("shuffleBtn").classList.toggle("on", shuffle);
  $("repeatBtn").classList.toggle("on", repeat);
}

// ==========================================
// 4. ADD SONGS TO THE ARRAY
// ==========================================

function addFiles(fileList) {
  const files = Array.from(fileList).filter(file =>
    file.type.startsWith("audio/") ||
    /\.(mp3|wav|m4a|ogg|aac|flac|opus)$/i.test(file.name)
  );

  if (!files.length) {
    toast("Choose one or more audio files.");
    return;
  }

  files.forEach(file => {
    // Check whether this file belongs to a previously saved song.
    const savedTrack = playlist.find(track =>
      track.unavailable &&
      track.fileName &&
      track.fileName.toLowerCase() === file.name.toLowerCase()
    );

    if (savedTrack) {
      const url = URL.createObjectURL(file);
      objectUrls.push(url);

      savedTrack.file = file;
      savedTrack.url = url;
      savedTrack.unavailable = false;

      playlists.forEach(item => {
        if (!item.trackIds.includes(savedTrack.id)) {
          item.trackIds.push(savedTrack.id);
        }
      });

      const probe = new Audio();
      probe.preload = "metadata";
      probe.src = url;

      probe.addEventListener("loadedmetadata", () => {
        savedTrack.duration = Number.isFinite(probe.duration)
          ? probe.duration
          : savedTrack.duration;

        render();
      }, { once: true });

      return;
    }

    const url = URL.createObjectURL(file);
    objectUrls.push(url);

    const title = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim();

    const track = {
      id: Date.now().toString(36) +
          Math.random().toString(36).slice(2),

      title: title || file.name,
      fileName: file.name,
      artist: "Local audio",
      file: file,
      url: url,
      addedAt: new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
      }),
      liked: false,
      duration: 0
    };

    // Store the song in the main array.
    playlist.push(track);

    // Add its ID to the selected playlist array.
    if (!activePlaylist().trackIds.includes(track.id)) {
      activePlaylist().trackIds.push(track.id);
    }

    // Read the audio duration.
    const probe = new Audio();
    probe.preload = "metadata";
    probe.src = url;

    probe.addEventListener("loadedmetadata", () => {
      track.duration = Number.isFinite(probe.duration)
        ? probe.duration
        : 0;

      render();
    }, { once: true });
  });

  fileInput.value = "";

  render();

  toast(`${files.length} song(s) added.`);

  if (!currentTrack()) {
    const firstTrack = tracksForActivePlaylist()[0];

    if (firstTrack && !firstTrack.unavailable) {
      playTrack(firstTrack.id);
    }
  }
}

// ==========================================
// 5. PLAY, PAUSE, NEXT AND PREVIOUS
// ==========================================

async function playTrack(id) {
  const track = playlist.find(item => item.id === id);

  if (!track) return;

  if (track.unavailable || !track.url) {
    toast("Please select this song's audio file again.");
    fileInput.click();
    return;
  }

  currentId = id;

  if (audio.src !== track.url) {
    audio.src = track.url;
  }

  try {
    await audio.play();
  } catch (error) {
    toast("Press Play to start this track.");
  }

  render();
}

async function togglePlay() {
  if (!playlist.length) {
    toast("Add some audio files first.");
    fileInput.click();
    return;
  }

  if (!currentTrack()) {
    const firstTrack = tracksForActivePlaylist().find(
      track => !track.unavailable
    );

    if (firstTrack) {
      await playTrack(firstTrack.id);
    } else {
      toast("Select your audio files again to play them.");
    }

    return;
  }

  if (currentTrack().unavailable) {
    toast("Select this song's audio file again.");
    fileInput.click();
    return;
  }

  if (audio.paused) {
    try {
      await audio.play();
    } catch (error) {
      toast("Unable to play this audio file.");
    }
  } else {
    audio.pause();
  }

  render();
}

function nextTrack() {
  const tracks = tracksForActivePlaylist().filter(
    track => !track.unavailable
  );

  if (!tracks.length) return;

  const index = tracks.findIndex(track => track.id === currentId);

  let nextIndex;

  if (shuffle && tracks.length > 1) {
    const choices = tracks.filter(track => track.id !== currentId);

    const chosen = choices[Math.floor(Math.random() * choices.length)];

    nextIndex = tracks.findIndex(track => track.id === chosen.id);
  } else {
    nextIndex = (index + 1 + tracks.length) % tracks.length;
  }

  playTrack(tracks[nextIndex].id);
}

function previousTrack() {
  const tracks = tracksForActivePlaylist().filter(
    track => !track.unavailable
  );

  if (!tracks.length) return;

  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }

  const index = tracks.findIndex(track => track.id === currentId);

  const previousIndex =
    (index - 1 + tracks.length) % tracks.length;

  playTrack(tracks[previousIndex].id);
}

// ==========================================
// 6. REMOVE SONGS
// ==========================================

function removeTrack(id) {
  const index = playlist.findIndex(track => track.id === id);

  if (index < 0) return;

  const wasCurrent = playlist[index].id === currentId;

  playlist.splice(index, 1);

  playlists.forEach(item => {
    item.trackIds = item.trackIds.filter(trackId => trackId !== id);
  });

  if (wasCurrent) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();

    currentId = null;
  }

  render();
  toast("Song removed.");
}

// ==========================================
// 7. BUTTON EVENT LISTENERS
// ==========================================

fileInput.addEventListener("change", event => {
  addFiles(event.target.files);
});

$("heroAdd").addEventListener("click", () => {
  fileInput.click();
});

$("heroPlay").addEventListener("click", togglePlay);
$("playBtn").addEventListener("click", togglePlay);
$("nextBtn").addEventListener("click", nextTrack);
$("prevBtn").addEventListener("click", previousTrack);

$("shuffleBtn").addEventListener("click", () => {
  shuffle = !shuffle;

  render();

  toast(shuffle ? "Shuffle is on." : "Shuffle is off.");
});

$("shuffleAll").addEventListener("click", () => {
  shuffle = !shuffle;

  render();

  toast(shuffle ? "Shuffle is on." : "Shuffle is off.");
});

$("repeatBtn").addEventListener("click", () => {
  repeat = !repeat;

  audio.loop = repeat;

  render();

  toast(repeat ? "Repeat is on." : "Repeat is off.");
});

$("search").addEventListener("input", render);

// ==========================================
// 8. CREATE MULTIPLE PLAYLISTS
// ==========================================

$("createPlaylist").addEventListener("click", () => {
  const name = $("newPlaylistName").value.trim();

  if (!name) {
    toast("Enter a playlist name.");
    return;
  }

  const newList = {
    id: "list-" + Date.now(),
    name: name,
    trackIds: []
  };

  playlists.push(newList);

  activePlaylistId = newList.id;

  $("newPlaylistName").value = "";

  view = "all";

  updateNavigation();
  render();

  toast(`Created playlist: ${name}`);
});

$("playlistSelect").addEventListener("change", event => {
  activePlaylistId = event.target.value;

  view = "all";

  updateNavigation();
  render();
});

function updateNavigation() {
  $("navAll").classList.toggle("active", view === "all");
  $("navLiked").classList.toggle("active", view === "liked");
  $("navRecent").classList.toggle("active", view === "recent");
}

// ==========================================
// 9. LIKED AND RECENT SONGS
// ==========================================

$("navAll").addEventListener("click", () => {
  view = "all";
  updateNavigation();
  render();
});

$("navLiked").addEventListener("click", () => {
  view = view === "liked" ? "all" : "liked";

  updateNavigation();
  render();
});

$("navRecent").addEventListener("click", () => {
  view = view === "recent" ? "all" : "recent";

  updateNavigation();
  render();
});

$("trackRows").addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    const row = event.target.closest("tr");

    if (row) {
      const playButton = row.querySelector('[data-action="play"]');

      if (playButton) {
        playTrack(playButton.dataset.id);
      }
    }

    return;
  }

  const id = button.dataset.id;

  if (button.dataset.action === "play") {
    if (currentId === id && !audio.paused) {
      audio.pause();
    } else {
      playTrack(id);
    }
  }

  if (button.dataset.action === "edit") {
    const track = playlist.find(item => item.id === id);

    if (!track) return;

    const title = prompt("Enter song title:", track.title);

    if (title === null) return;

    const artist = prompt("Enter artist name:", track.artist);

    if (artist === null) return;

    track.title = title.trim() || track.title;
    track.artist = artist.trim() || "Unknown artist";

    render();

    toast("Song details updated. Press Save to keep them.");
  }

  if (button.dataset.action === "like") {
    const track = playlist.find(item => item.id === id);

    if (track) {
      track.liked = !track.liked;
    }
  }

  if (button.dataset.action === "remove") {
    removeTrack(id);
  }

  render();
});

$("likeCurrent").addEventListener("click", () => {
  const track = currentTrack();

  if (!track) {
    toast("Choose a track first.");
    return;
  }

  track.liked = !track.liked;

  render();
});

// ==========================================
// 10. SAVE PLAYLIST INFORMATION
// ==========================================

function saveData() {
  return {
    version: 1,

    playlists: playlists.map(item => ({
      id: item.id,
      name: item.name,
      trackIds: item.trackIds
    })),

    tracks: playlist.map(track => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      fileName: track.fileName || "",
      addedAt: track.addedAt,
      liked: track.liked,
      duration: track.duration
    }))
  };
}

$("savePlaylist").addEventListener("click", () => {
  try {
    localStorage.setItem(
      "arrayMusicPlaylist",
      JSON.stringify(saveData())
    );

    toast("Playlist details saved in this browser.");
  } catch (error) {
    toast("Unable to save playlist details.");
  }
});

// ==========================================
// 11. EXPORT PLAYLIST TO JSON
// ==========================================

$("exportPlaylist").addEventListener("click", () => {
  const data = saveData();

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = "array-music-playlist.json";

  link.click();

  URL.revokeObjectURL(url);

  toast("Playlist information exported.");
});

// ==========================================
// 12. IMPORT PLAYLIST FROM JSON
// ==========================================

$("importPlaylist").addEventListener("click", () => {
  $("playlistFile").click();
});

$("playlistFile").addEventListener("change", async event => {
  const file = event.target.files[0];

  if (!file) return;

  try {
    const data = JSON.parse(await file.text());

    if (!Array.isArray(data.tracks) ||
        !Array.isArray(data.playlists)) {
      throw new Error("Invalid playlist file");
    }

    data.tracks.forEach(saved => {
      const existing = playlist.find(track => track.id === saved.id);

      if (existing) {
        existing.title = saved.title || existing.title;
        existing.artist = saved.artist || existing.artist;
        existing.liked = Boolean(saved.liked);
      }
    });

    data.playlists.forEach(saved => {
      const name = String(saved.name || "Imported playlist");

      let target = playlists.find(item => item.name === name);

      if (!target) {
        target = {
          id: "list-" + Date.now() + Math.random(),
          name: name,
          trackIds: []
        };

        playlists.push(target);
      }

      if (Array.isArray(saved.trackIds)) {
        const validIds = saved.trackIds.filter(id =>
          playlist.some(track => track.id === id)
        );

        target.trackIds = [
          ...new Set([...target.trackIds, ...validIds])
        ];
      }
    });

    render();

    toast("Playlist data imported.");
  } catch (error) {
    toast("Invalid playlist JSON file.");
  }

  event.target.value = "";
});

// ==========================================
// 13. DARK AND LIGHT THEME
// ==========================================

$("themeToggle").addEventListener("click", () => {
  darkTheme = !darkTheme;

  if (darkTheme) {
    document.documentElement.style.setProperty("--bg", "#0b1020");
    document.documentElement.style.setProperty("--panel", "#141b30");
    document.documentElement.style.setProperty("--panel2", "#1a2340");
    document.documentElement.style.setProperty("--text", "#f2f5ff");
    document.documentElement.style.setProperty("--muted", "#9da8c5");
    document.documentElement.style.setProperty("--line", "#2b3553");
  } else {
    document.documentElement.style.setProperty("--bg", "#f3f5fb");
    document.documentElement.style.setProperty("--panel", "#ffffff");
    document.documentElement.style.setProperty("--panel2", "#f7f8fc");
    document.documentElement.style.setProperty("--text", "#172039");
    document.documentElement.style.setProperty("--muted", "#6d7690");
    document.documentElement.style.setProperty("--line", "#e4e8f2");
  }

  toast(darkTheme ? "Dark theme selected." : "Light theme selected.");
});

// ==========================================
// 14. CLEAR THE PLAYLIST
// ==========================================

$("clearList").addEventListener("click", () => {
  if (!playlist.length) {
    toast("Your playlist is already empty.");
    return;
  }

  if (!confirm("Remove every song from the library?")) {
    return;
  }

  audio.pause();
  audio.removeAttribute("src");
  audio.load();

  currentId = null;

  playlist.splice(0, playlist.length);

  playlists.forEach(item => {
    item.trackIds = [];
  });

  objectUrls.forEach(url => URL.revokeObjectURL(url));
  objectUrls = [];

  render();

  toast("Playlist cleared.");
});

// ==========================================
// 15. VOLUME AND PLAYBACK PROGRESS
// ==========================================

$("volume").addEventListener("input", event => {
  audio.volume = Number(event.target.value);
});

$("progress").addEventListener("input", event => {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    audio.currentTime =
      (Number(event.target.value) / 1000) * audio.duration;
  }
});

audio.volume = 0.8;

audio.addEventListener("timeupdate", () => {
  $("currentTime").textContent = formatTime(audio.currentTime);
  $("duration").textContent = formatTime(audio.duration);

  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    $("progress").value = Math.round(
      (audio.currentTime / audio.duration) * 1000
    );
  }
});

audio.addEventListener("loadedmetadata", () => {
  const track = currentTrack();

  if (track && Number.isFinite(audio.duration)) {
    track.duration = audio.duration;
  }

  render();
});

audio.addEventListener("play", render);
audio.addEventListener("pause", render);

audio.addEventListener("ended", () => {
  if (!repeat) {
    nextTrack();
  }
});

audio.addEventListener("error", () => {
  if (currentTrack()) {
    toast("This audio format may not be supported.");
  }
});

// ==========================================
// 16. DRAG AND DROP AUDIO UPLOAD
// ==========================================

const dropZone = $("dropZone");

["dragenter", "dragover"].forEach(type => {
  dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.classList.add("drag");
  });
});

["dragleave", "drop"].forEach(type => {
  dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.classList.remove("drag");
  });
});

dropZone.addEventListener("drop", event => {
  addFiles(event.dataTransfer.files);
});

// ==========================================
// 17. RESTORE SAVED PLAYLIST INFORMATION
// ==========================================

try {
  const saved = JSON.parse(
    localStorage.getItem("arrayMusicPlaylist") || "null"
  );

  if (saved &&
      Array.isArray(saved.playlists) &&
      Array.isArray(saved.tracks)) {

    playlists.splice(0, playlists.length);

    saved.playlists.forEach(item => {
      playlists.push({
        id: String(item.id),
        name: String(item.name || "My playlist"),
        trackIds: Array.isArray(item.trackIds)
          ? item.trackIds
          : []
      });
    });

    if (!playlists.some(item => item.id === "default")) {
      playlists.unshift({
        id: "default",
        name: "My playlist",
        trackIds: []
      });
    }

    saved.tracks.forEach(item => {
      playlist.push({
        id: String(item.id),
        title: String(item.title || "Untitled track"),
        artist: String(item.artist || "Local audio"),
        fileName: String(item.fileName || ""),
        file: null,
        url: "",
        addedAt: String(item.addedAt || "Previously saved"),
        liked: Boolean(item.liked),
        duration: Number(item.duration) || 0,
        unavailable: true
      });
    });

    // Repair playlist references to saved songs.
    saved.tracks.forEach(track => {
      const trackIds = playlists
        .filter(item => item.trackIds.includes(track.id))
        .map(item => item.id);

      if (!trackIds.length) {
        playlists[0].trackIds.push(track.id);
      }
    });

    activePlaylistId = playlists[0].id;
  }
} catch (error) {
  // Start with an empty playlist if saved data is invalid.
}

// Display the initial app.
render();
