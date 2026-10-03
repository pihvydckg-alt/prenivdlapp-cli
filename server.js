const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;

// API Endpoints
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

// Full Web UI
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
    <p class="text-slate-400 text-sm mt-1">TikTok, Facebook, Instagram, YouTube, Spotify ও অন্যান্য মিডিয়া ডাউনলোড করুন</p>
  </header>

  <main class="max-w-2xl mx-auto px-4 py-8 w-full">
    <div class="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-2xl">
      <label class="block text-sm font-medium text-slate-300 mb-2">সোশ্যাল মিডিয়া ভিডিও/অডিও লিংক পেস্ট করুন:</label>
      <div class="flex flex-col sm:flex-row gap-3">
        <input id="urlInput" type="url" placeholder="https://www.tiktok.com/... বা https://open.spotify.com/..." 
          class="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none text-white text-sm" />
        <button id="downloadBtn" onclick="processUrl()" 
          class="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-semibold rounded-xl transition duration-200 shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2">
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

    <div id="resultBox" class="hidden mt-6 bg-slate-900/90 p-5 rounded-2xl border border-slate-700 shadow-xl">
      <div class="flex flex-col sm:flex-row gap-4 items-center">
        <img id="thumbImg" src="" alt="Thumbnail" class="w-full sm:w-44 h-40 object-cover rounded-xl bg-slate-800 border border-slate-700" />
        <div class="flex-1 w-full">
          <h2 id="mediaTitle" class="text-base font-bold line-clamp-2 text-slate-100"></h2>
          <p id="mediaAuthor" class="text-xs text-slate-400 mt-1"></p>
          <div id="downloadButtons" class="mt-4 flex flex-wrap gap-2"></div>
        </div>
      </div>
    </div>
  </main>

  <footer class="py-4 text-center text-xs text-slate-500 border-t border-slate-900">
    PrenivDL API & Web Service • Powered by Render
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
      showStatus('<i class="fa-solid fa-spinner fa-spin mr-2"></i>ডাটা লোড হচ্ছে, একটু অপেক্ষা করুন...', 'bg-blue-500/20 text-cyan-300 border border-cyan-500/30');
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
        showStatus('ত্রুটি: ' + (err.message || 'ডাউনলোড লিংক তৈরি করা যায়নি'), 'bg-rose-500/20 text-rose-300 border border-rose-500/30');
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
      
      const thumb = document.getElementById('thumbImg');
      if (data.thumbnail) {
        thumb.src = data.thumbnail;
        thumb.classList.remove('hidden');
      } else {
        thumb.classList.add('hidden');
      }

      const btnContainer = document.getElementById('downloadButtons');
      btnContainer.innerHTML = '';

      if (data.downloads && data.downloads.length > 0) {
        data.downloads.forEach(dl => {
          const a = document.createElement('a');
          a.href = dl.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.className = 'px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition shadow flex items-center gap-2';
          a.innerHTML = '<i class="fa-solid fa-download"></i> ' + (dl.label || 'Download');
          btnContainer.appendChild(a);
        });
      }

      box.classList.remove('hidden');
    }
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  // CORS হেডার (Lovable বা যেকোনো ফ্রন্টএন্ড থেকে কল করার জন্য)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsed = url.parse(req.url, true);

  // API এন্ডপয়েন্ট (যা Lovable লাইব্রেরি হিসেবে কল করবে)
  if (parsed.pathname === '/api/download') {
    const mediaUrl = parsed.query.url;
    if (!mediaUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'URL parameter missing' }));
    }

    const platform = detectPlatform(mediaUrl);
    if (!platform || !API_MAP[platform]) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Unsupported platform' }));
    }

    try {
      const apiUrl = `${API_MAP[platform]}${encodeURIComponent(mediaUrl)}`;
      const result = await fetchJson(apiUrl);

      if (!result || !result.status) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Failed to fetch media data' }));
      }

      const downloads = [];
      const d = result.data || {};

      if (d.video_hd || d.hd) downloads.push({ label: 'Download Video (HD MP4)', url: d.video_hd || d.hd });
      if (d.video_sd || d.sd) downloads.push({ label: 'Download Video (SD MP4)', url: d.video_sd || d.sd });
      if (d.video && !d.video_hd) downloads.push({ label: 'Download Video (MP4)', url: d.video });
      if (d.audio || d.music) downloads.push({ label: 'Download Audio (MP3)', url: d.audio || d.music });
      if (Array.isArray(d.downloads)) {
        d.downloads.forEach((item, idx) => {
          downloads.push({ label: item.title || ('Format ' + (idx + 1)), url: item.url });
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        data: {
          title: d.title || result.title || 'Media File',
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

  // রুট পেজে ওয়েবসাইট ডিজাইন দেখাবে
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML_CONTENT);
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
