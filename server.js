const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;

const API_MAP = {
  tiktok: 'https://prenivapi.vercel.app/api/tiktok?url=',
  facebook: 'https://prenivapi.vercel.app/api/facebookv1?url=',
  instagram: 'https://prenivapi.vercel.app/api/igdl?url=',
  twitter: 'https://prenivapi.vercel.app/api/twitter?url=',
  youtube: 'https://prenivapi.vercel.app/api/youtube?url=',
  spotify: 'https://prenivapi.vercel.app/api/spotify?url=',
  pinterest: 'https://prenivapi.vercel.app/api/pinterest?url=',
  capcut: 'https://prenivapi.vercel.app/api/capcut?url=',
  threads: 'https://prenivapi.vercel.app/api/threads?url='
};

function detectPlatform(targetUrl) {
  const u = targetUrl.toLowerCase();
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('facebook.com') || u.includes('fb.watch')) return 'facebook';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'twitter';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('spotify.com')) return 'spotify';
  if (u.includes('pinterest.com') || u.includes('pin.it')) return 'pinterest';
  if (u.includes('capcut.com')) return 'capcut';
  if (u.includes('threads.net')) return 'threads';
  return null;
}

function fetchJson(apiUrl) {
  return new Promise((resolve, reject) => {
    https.get(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Universal Social Media Downloader</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body { background: radial-gradient(circle at top, #1e1b4b, #0f172a, #020617); min-height: 100vh; }
  </style>
</head>
<body class="text-white font-sans flex flex-col justify-between min-h-screen">
  <header class="py-6 border-b border-slate-800 text-center">
    <h1 class="text-3xl font-extrabold bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-500 bg-clip-text text-transparent">
      <i class="fa-solid fa-cloud-arrow-down mr-2 text-cyan-400"></i>PRENIV DL
    </h1>
    <p class="text-slate-400 text-sm mt-1">TikTok, Facebook, Instagram, YouTube, Spotify ডাউনলোডার</p>
  </header>

  <main class="max-w-2xl mx-auto px-4 py-8 w-full">
    <div class="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-2xl">
      <label class="block text-sm font-medium text-slate-300 mb-2">ভিডিও বা অডিও লিংক পেস্ট করুন:</label>
      <div class="flex flex-col sm:flex-row gap-3">
        <input id="urlInput" type="url" placeholder="https://www.tiktok.com/... বা https://www.facebook.com/..." 
          class="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 outline-none text-white text-sm" />
        <button id="downloadBtn" onclick="processUrl()" 
          class="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-semibold rounded-xl transition shadow flex items-center justify-center gap-2">
          <span>খুঁজুন</span>
          <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>

      <div class="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
        <span class="px-2 py-1 rounded bg-slate-800"><i class="fa-brands fa-tiktok text-pink-400 mr-1"></i>TikTok</span>
        <span class="px-2 py-1 rounded bg-slate-800"><i class="fa-brands fa-facebook text-blue-400 mr-1"></i>Facebook</span>
        <span class="px-2 py-1 rounded bg-slate-800"><i class="fa-brands fa-instagram text-purple-400 mr-1"></i>Instagram</span>
        <span class="px-2 py-1 rounded bg-slate-800"><i class="fa-brands fa-youtube text-red-500 mr-1"></i>YouTube</span>
        <span class="px-2 py-1 rounded bg-slate-800"><i class="fa-brands fa-spotify text-emerald-400 mr-1"></i>Spotify</span>
      </div>
    </div>

    <div id="status" class="hidden mt-6 text-center text-sm py-3 px-4 rounded-xl"></div>

    <!-- Media Player & Download Card -->
    <div id="resultBox" class="hidden mt-6 bg-slate-900/90 p-6 rounded-2xl border border-slate-700 shadow-2xl flex flex-col gap-6">
      
      <!-- Title & Details -->
      <div>
        <h2 id="mediaTitle" class="text-lg font-bold text-slate-100"></h2>
        <p id="mediaAuthor" class="text-xs text-slate-400 mt-1"></p>
      </div>

      <!-- 1. Cover Box -->
      <div id="coverSection" class="hidden flex flex-col items-center bg-slate-950/60 p-4 rounded-xl border border-slate-800">
        <span class="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">১. কভার ফটো (Cover)</span>
        <img id="thumbImg" src="" alt="Cover" class="w-48 h-48 object-cover rounded-xl shadow-md border border-slate-700" />
        <a id="coverDlBtn" href="#" target="_blank" download="cover.jpg" 
          class="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition flex items-center gap-2">
          <i class="fa-solid fa-image"></i> Download Cover
        </a>
      </div>

      <!-- 2. Video Player Box -->
      <div id="videoSection" class="hidden flex flex-col bg-slate-950/60 p-4 rounded-xl border border-slate-800">
        <span class="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide text-center">২. ভিডিও প্লেয়ার (Video Player)</span>
        <video id="videoPlayer" controls class="w-full max-h-96 rounded-xl bg-black border border-slate-800"></video>
        <div id="videoDownloadButtons" class="mt-4 flex flex-wrap gap-2 justify-center"></div>
      </div>

      <!-- 3. Audio Player Box -->
      <div id="audioSection" class="hidden flex flex-col bg-slate-950/60 p-4 rounded-xl border border-slate-800">
        <span class="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide text-center">৩. অডিও প্লেয়ার (Audio Player)</span>
        <audio id="audioPlayer" controls class="w-full mt-1"></audio>
        <div id="audioDownloadButtons" class="mt-4 flex flex-wrap gap-2 justify-center"></div>
      </div>

    </div>
  </main>

  <footer class="py-4 text-center text-xs text-slate-500 border-t border-slate-900">
    PrenivDL Service • Powered by Render
  </footer>

  <script>
    async function processUrl() {
      const input = document.getElementById('urlInput');
      const val = input.value.trim();
      const status = document.getElementById('status');
      const resultBox = document.getElementById('resultBox');
      const downloadBtn = document.getElementById('downloadBtn');

      if (!val) {
        showStatus('অনুগ্রহ করে একটি লিংক দিন!', 'bg-amber-500/20 text-amber-300 border border-amber-500/30');
        return;
      }

      resultBox.classList.add('hidden');
      showStatus('<i class="fa-solid fa-spinner fa-spin mr-2"></i>মিডিয়া প্রসেস হচ্ছে, কয়েক সেকেন্ড অপেক্ষা করুন...', 'bg-blue-500/20 text-cyan-300 border border-cyan-500/30');
      downloadBtn.disabled = true;

      try {
        const res = await fetch('/api/download?url=' + encodeURIComponent(val));
        const resData = await res.json();

        if (!resData.success) {
          throw new Error(resData.error || 'মিডিয়া খুঁজে পাওয়া যায়নি');
        }

        status.classList.add('hidden');
        renderResult(resData.data);
      } catch (err) {
        showStatus('ত্রুটি: ' + (err.message || 'মিডিয়া লোড করা যায়নি। লিংকটি সঠিক কিনা বা পাবলিক কিনা চেক করুন।'), 'bg-rose-500/20 text-rose-300 border border-rose-500/30');
      } finally {
        downloadBtn.disabled = false;
      }
    }

    function showStatus(text, classes) {
      const s = document.getElementById('status');
      s.className = 'mt-6 text-center text-sm py-3 px-4 rounded-xl ' + classes;
      s.innerHTML = text;
      s.classList.remove('hidden');
    }

    function renderResult(data) {
      const box = document.getElementById('resultBox');
      document.getElementById('mediaTitle').innerText = data.title || 'মিডিয়া ফাইল';
      document.getElementById('mediaAuthor').innerText = data.author ? 'লেখক/শিল্পী: ' + data.author : '';

      // 1. Cover
      const coverSection = document.getElementById('coverSection');
      if (data.thumbnail) {
        document.getElementById('thumbImg').src = data.thumbnail;
        document.getElementById('coverDlBtn').href = data.thumbnail;
        coverSection.classList.remove('hidden');
      } else {
        coverSection.classList.add('hidden');
      }

      // 2. Video Player & Downloads
      const videoSection = document.getElementById('videoSection');
      const videoPlayer = document.getElementById('videoPlayer');
      const videoDlContainer = document.getElementById('videoDownloadButtons');
      videoDlContainer.innerHTML = '';

      const videoList = (data.downloads || []).filter(d => d.type === 'video');
      if (videoList.length > 0) {
        videoPlayer.src = videoList[0].url;
        videoList.forEach(v => {
          const a = document.createElement('a');
          a.href = v.url;
          a.target = '_blank';
          a.className = 'px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition shadow flex items-center gap-2';
          a.innerHTML = '<i class="fa-solid fa-video"></i> ' + (v.label || 'Download Video');
          videoDlContainer.appendChild(a);
        });
        videoSection.classList.remove('hidden');
      } else {
        videoSection.classList.add('hidden');
        videoPlayer.removeAttribute('src');
      }

      // 3. Audio Player & Downloads
      const audioSection = document.getElementById('audioSection');
      const audioPlayer = document.getElementById('audioPlayer');
      const audioDlContainer = document.getElementById('audioDownloadButtons');
      audioDlContainer.innerHTML = '';

      const audioList = (data.downloads || []).filter(d => d.type === 'audio');
      if (audioList.length > 0) {
        audioPlayer.src = audioList[0].url;
        audioList.forEach(aItem => {
          const a = document.createElement('a');
          a.href = aItem.url;
          a.target = '_blank';
          a.className = 'px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs rounded-lg transition shadow flex items-center gap-2';
          a.innerHTML = '<i class="fa-solid fa-music"></i> ' + (aItem.label || 'Download Audio');
          audioDlContainer.appendChild(a);
        });
        audioSection.classList.remove('hidden');
      } else {
        audioSection.classList.add('hidden');
        audioPlayer.removeAttribute('src');
      }

      box.classList.remove('hidden');
    }
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsed = url.parse(req.url, true);

  if (parsed.pathname === '/api/download') {
    const mediaUrl = parsed.query.url;
    if (!mediaUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'URL parameter missing' }));
    }

    const platform = detectPlatform(mediaUrl);
    if (!platform || !API_MAP[platform]) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'এই প্ল্যাটফর্মটি সমর্থিত নয়।' }));
    }

    try {
      const apiUrl = `${API_MAP[platform]}${encodeURIComponent(mediaUrl)}`;
      const result = await fetchJson(apiUrl);

      if (!result || !result.status || !result.data) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'ভিডিও/অডিওর লিংক পাওয়া যায়নি। লিংকটি প্রাইভেট বা ইনভ্যালিড হতে পারে।' }));
      }

      const downloads = [];
      const d = result.data || {};

      // Handle Videos
      if (d.video_hd || d.hd) downloads.push({ label: 'Download Video (HD MP4)', url: d.video_hd || d.hd, type: 'video' });
      if (d.video_sd || d.sd) downloads.push({ label: 'Download Video (SD MP4)', url: d.video_sd || d.sd, type: 'video' });
      if (d.video && !d.video_hd) downloads.push({ label: 'Download Video (MP4)', url: d.video, type: 'video' });

      // Handle Audios
      if (d.audio || d.music) downloads.push({ label: 'Download Audio (MP3)', url: d.audio || d.music, type: 'audio' });

      // Handle Media Arrays (Instagram/TikTok/YouTube)
      if (Array.isArray(d.media)) {
        d.media.forEach(m => {
          if (m && m.url) {
            const isVideo = m.url.includes('.mp4') || (m.type && m.type.includes('video'));
            downloads.push({
              label: isVideo ? 'Download Video (MP4)' : 'Download Image',
              url: m.url,
              type: isVideo ? 'video' : 'image'
            });
          }
        });
      }

      if (Array.isArray(d.downloads)) {
        d.downloads.forEach(dl => {
          if (typeof dl === 'string') {
            downloads.push({ label: 'Download Video (MP4)', url: dl, type: 'video' });
          } else if (dl && dl.url) {
            downloads.push({ label: dl.title || 'Download Video', url: dl.url, type: 'video' });
          }
        });
      }

      // Check if any download link exists
      if (downloads.length === 0 && !d.thumbnail && !d.cover) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'এই লিংক থেকে কোনো মিডিয়া ফাইল পাওয়া যায়নি।' }));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        data: {
          title: d.title || result.title || 'Social Media File',
          author: d.author || result.author || '',
          thumbnail: d.thumbnail || d.cover || result.thumbnail || '',
          downloads: downloads
        }
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML_CONTENT);
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
