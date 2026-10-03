const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;

const API_ENDPOINTS = {
  tiktok: 'https://prenivapi.vercel.app/api/tiktok?url=',
  facebook: 'https://prenivapi.vercel.app/api/facebookv1?url=',
  instagram: 'https://prenivapi.vercel.app/api/igdl?url=',
  twitter: 'https://prenivapi.vercel.app/api/twitter?url=',
  youtube: 'https://prenivapi.vercel.app/api/youtube?url=',
  spotify: 'https://prenivapi.vercel.app/api/spotify?url=',
  pinterest: 'https://prenivapi.vercel.app/api/pinterest?url=',
  applemusic: 'https://prenivapi.vercel.app/api/applemusic?url=',
  capcut: 'https://prenivapi.vercel.app/api/capcut?url=',
  threads: 'https://prenivapi.vercel.app/api/threads?url='
};

function detectPlatform(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('tiktok.com')) return 'tiktok';
    if (host.includes('facebook.com') || host.includes('fb.watch')) return 'facebook';
    if (host.includes('instagram.com')) return 'instagram';
    if (host.includes('twitter.com') || host.includes('x.com')) return 'twitter';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
    if (host.includes('spotify.com')) return 'spotify';
    if (host.includes('pinterest.com') || host.includes('pin.it')) return 'pinterest';
    if (host.includes('music.apple.com')) return 'applemusic';
    if (host.includes('capcut.com')) return 'capcut';
    if (host.includes('threads.net')) return 'threads';
  } catch (e) {}
  return null;
}

function fetchJson(targetUrl) {
  return new Promise((resolve, reject) => {
    https.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response from upstream provider'));
        }
      });
    }).on('error', reject);
  });
}

function normalizeData(raw, platform) {
  const d = (raw && raw.data) ? raw.data : raw;
  if (!d) return null;

  const downloads = [];
  const thumbnail = d.thumbnail || d.cover || d.image || d.poster || null;
  const title = d.title || d.caption || `${platform ? platform.toUpperCase() : 'Social Media'} File`;
  const author = d.author || d.creator || d.channel || null;

  // 1. Check if downloads is an object: { video: [...], audio: [...] }
  if (d.downloads && typeof d.downloads === 'object' && !Array.isArray(d.downloads)) {
    if (Array.isArray(d.downloads.video)) {
      d.downloads.video.forEach((v, idx) => {
        if (typeof v === 'string') {
          downloads.push({ label: `Download Video ${idx + 1} (MP4)`, url: v, type: 'video' });
        } else if (v && v.url) {
          downloads.push({ label: v.title || `Download Video ${idx + 1}`, url: v.url, type: 'video' });
        }
      });
    }
    if (Array.isArray(d.downloads.audio)) {
      d.downloads.audio.forEach((a, idx) => {
        if (typeof a === 'string') {
          downloads.push({ label: `Download Audio ${idx + 1} (MP3)`, url: a, type: 'audio' });
        } else if (a && a.url) {
          downloads.push({ label: a.title || `Download Audio ${idx + 1}`, url: a.url, type: 'audio' });
        }
      });
    }
  }

  // 2. Check if downloads is an array
  if (Array.isArray(d.downloads)) {
    d.downloads.forEach(dl => {
      if (typeof dl === 'string') {
        downloads.push({ label: 'Download Video (MP4)', url: dl, type: 'video' });
      } else if (dl && dl.url) {
        downloads.push({ label: dl.title || 'Download Media', url: dl.url, type: dl.type || 'video' });
      }
    });
  }

  // 3. Direct video/audio fields
  if (d.video_hd || d.hd) downloads.push({ label: 'Download Video (HD MP4)', url: d.video_hd || d.hd, type: 'video' });
  if (d.video_sd || d.sd) downloads.push({ label: 'Download Video (SD MP4)', url: d.video_sd || d.sd, type: 'video' });
  if (d.video && !downloads.some(x => x.url === d.video)) {
    downloads.push({ label: 'Download Video (MP4)', url: d.video, type: 'video' });
  }
  if (d.audio || d.music) {
    const audioUrl = d.audio || d.music;
    if (!downloads.some(x => x.url === audioUrl)) {
      downloads.push({ label: 'Download Audio (MP3)', url: audioUrl, type: 'audio' });
    }
  }

  // 4. Media array (Instagram style)
  if (Array.isArray(d.media)) {
    d.media.forEach((m, idx) => {
      if (!m) return;
      const mediaUrl = typeof m === 'string' ? m : m.url;
      if (!mediaUrl) return;
      const isVideo = mediaUrl.includes('.mp4') || (m.type && m.type.includes('video'));
      downloads.push({
        label: isVideo ? `Download Video ${idx + 1}` : `Download Image ${idx + 1}`,
        url: mediaUrl,
        type: isVideo ? 'video' : 'image'
      });
    });
  }

  if (downloads.length === 0 && !thumbnail) {
    return null;
  }

  return { title, author, thumbnail, downloads };
}

const HTML_PAGE = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Social Media Downloader</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body { background: radial-gradient(circle at top, #1e1b4b, #0f172a, #020617); min-height: 100vh; }
  </style>
</head>
<body class="text-slate-100 flex flex-col min-h-screen p-4 sm:p-6 justify-center items-center">
  <div class="w-full max-w-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl my-auto">
    <div class="text-center mb-6">
      <div class="inline-flex items-center justify-center w-14 h-14 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-2xl mb-3 text-2xl">
        <i class="fa-solid fa-cloud-arrow-down"></i>
      </div>
      <h1 class="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
        সোশ্যাল মিডিয়া ডাউনলোডার
      </h1>
      <p class="text-slate-400 text-sm mt-1">TikTok, Facebook, Instagram, Spotify, YouTube ইত্যাদি থেকে ডাউনলোড করুন</p>
    </div>

    <div class="flex flex-col sm:flex-row gap-3">
      <div class="relative flex-1">
        <i class="fa-solid fa-link absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
        <input id="urlInput" type="text" placeholder="এখানে ভিডিও বা অডিওর লিংক পেস্ট করুন..."
          class="w-full pl-11 pr-4 py-3.5 bg-slate-950/60 border border-slate-700/80 rounded-2xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner">
      </div>
      <button id="downloadBtn" onclick="processUrl()"
        class="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-medium px-6 py-3.5 rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30">
        <span>প্রসেস</span>
        <i class="fa-solid fa-arrow-right text-sm"></i>
      </button>
    </div>

    <div id="status" class="hidden mt-4 text-center text-sm py-3 px-4 rounded-xl"></div>

    <div id="resultBox" class="hidden mt-6 pt-6 border-t border-slate-800/80 space-y-6">
      <div class="text-center">
        <h3 id="mediaTitle" class="text-base sm:text-lg font-semibold text-slate-200 line-clamp-2"></h3>
        <p id="mediaAuthor" class="text-xs text-indigo-400 mt-1"></p>
      </div>

      <!-- Cover section -->
      <div id="coverSection" class="hidden flex flex-col items-center bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
        <span class="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider"><i class="fa-solid fa-image mr-1"></i> কভার ছবি</span>
        <img id="thumbImg" src="" alt="Cover" class="w-48 max-h-56 object-cover rounded-xl shadow-md border border-slate-700/50 mb-3">
        <a id="thumbDl" href="#" target="_blank" download="cover.jpg"
           class="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-xs px-4 py-2 rounded-xl border border-slate-700 text-slate-300">
          <i class="fa-solid fa-download"></i> Download Cover
        </a>
      </div>

      <!-- Video Player section -->
      <div id="videoSection" class="hidden flex flex-col items-center bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
        <span class="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider"><i class="fa-solid fa-play mr-1"></i> ভিডিও প্লেয়ার</span>
        <video id="videoPlayer" controls class="w-full max-h-80 rounded-xl bg-black mb-3"></video>
        <div id="videoButtons" class="flex flex-wrap gap-2 justify-center w-full"></div>
      </div>

      <!-- Audio Player section -->
      <div id="audioSection" class="hidden flex flex-col items-center bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
        <span class="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider"><i class="fa-solid fa-music mr-1"></i> অডিও প্লেয়ার</span>
        <audio id="audioPlayer" controls class="w-full mb-3"></audio>
        <div id="audioButtons" class="flex flex-wrap gap-2 justify-center w-full"></div>
      </div>

      <!-- Other downloads -->
      <div id="otherSection" class="hidden flex flex-col items-center">
        <div id="otherButtons" class="flex flex-wrap gap-2 justify-center"></div>
      </div>
    </div>
  </div>

  <script>
    async function processUrl() {
      const val = document.getElementById('urlInput').value.trim();
      const status = document.getElementById('status');
      const resultBox = document.getElementById('resultBox');
      const downloadBtn = document.getElementById('downloadBtn');

      if (!val) {
        showStatus('অনুগ্রহ করে একটি লিংক দিন!', 'bg-amber-500/20 text-amber-300 border border-amber-500/30');
        return;
      }

      resultBox.classList.add('hidden');
      showStatus('<i class="fa-solid fa-spinner fa-spin mr-2"></i>মিডিয়া প্রসেস হচ্ছে, অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন...', 'bg-blue-500/20 text-cyan-300 border border-cyan-500/30');
      downloadBtn.disabled = true;

      try {
        const res = await fetch('/api/download?url=' + encodeURIComponent(val));
        const resData = await res.json();

        if (!resData.success || !resData.data) {
          throw new Error(resData.error || 'মিডিয়া খুঁজে পাওয়া যায়নি');
        }

        status.classList.add('hidden');
        renderResult(resData.data);
      } catch (err) {
        showStatus('ত্রুটি: ' + (err.message || 'মিডিয়া লোড করা যায়নি। লিংকটি পাবলিক কিনা নিশ্চিত করুন।'), 'bg-rose-500/20 text-rose-300 border border-rose-500/30');
      } finally {
        downloadBtn.disabled = false;
      }
    }

    function showStatus(text, classes) {
      const s = document.getElementById('status');
      s.className = 'mt-4 text-center text-sm py-3 px-4 rounded-xl ' + classes;
      s.innerHTML = text;
      s.classList.remove('hidden');
    }

    function renderResult(data) {
      const box = document.getElementById('resultBox');
      document.getElementById('mediaTitle').innerText = data.title || 'মিডিয়া ফাইল';
      document.getElementById('mediaAuthor').innerText = data.author ? 'লেখক/শিল্পী: ' + data.author : '';

      // Cover
      const coverSection = document.getElementById('coverSection');
      if (data.thumbnail) {
        document.getElementById('thumbImg').src = data.thumbnail;
        document.getElementById('thumbDl').href = data.thumbnail;
        coverSection.classList.remove('hidden');
      } else {
        coverSection.classList.add('hidden');
      }

      const videoList = (data.downloads || []).filter(d => d.type === 'video');
      const audioList = (data.downloads || []).filter(d => d.type === 'audio');
      const otherList = (data.downloads || []).filter(d => d.type !== 'video' && d.type !== 'audio');

      // Video
      const videoSection = document.getElementById('videoSection');
      const videoPlayer = document.getElementById('videoPlayer');
      const videoBtns = document.getElementById('videoButtons');
      videoBtns.innerHTML = '';
      if (videoList.length > 0) {
        videoPlayer.src = videoList[0].url;
        videoList.forEach(v => {
          const a = document.createElement('a');
          a.href = v.url;
          a.target = '_blank';
          a.download = 'video.mp4';
          a.className = 'bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow';
          a.innerHTML = '<i class="fa-solid fa-download"></i> ' + v.label;
          videoBtns.appendChild(a);
        });
        videoSection.classList.remove('hidden');
      } else {
        videoPlayer.src = '';
        videoSection.classList.add('hidden');
      }

      // Audio
      const audioSection = document.getElementById('audioSection');
      const audioPlayer = document.getElementById('audioPlayer');
      const audioBtns = document.getElementById('audioButtons');
      audioBtns.innerHTML = '';
      if (audioList.length > 0) {
        audioPlayer.src = audioList[0].url;
        audioList.forEach(a => {
          const btn = document.createElement('a');
          btn.href = a.url;
          btn.target = '_blank';
          btn.download = 'audio.mp3';
          btn.className = 'bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow';
          btn.innerHTML = '<i class="fa-solid fa-music"></i> ' + a.label;
          audioBtns.appendChild(btn);
        });
        audioSection.classList.remove('hidden');
      } else {
        audioPlayer.src = '';
        audioSection.classList.add('hidden');
      }

      // Other
      const otherSection = document.getElementById('otherSection');
      const otherBtns = document.getElementById('otherButtons');
      otherBtns.innerHTML = '';
      if (otherList.length > 0) {
        otherList.forEach(item => {
          const btn = document.createElement('a');
          btn.href = item.url;
          btn.target = '_blank';
          btn.className = 'bg-slate-800 hover:bg-slate-700 text-white text-xs px-4 py-2 rounded-xl';
          btn.innerHTML = '<i class="fa-solid fa-download"></i> ' + item.label;
          otherBtns.appendChild(btn);
        });
        otherSection.classList.remove('hidden');
      } else {
        otherSection.classList.add('hidden');
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
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname === '/api/download') {
    const targetUrl = parsedUrl.query.url;
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'URL parameter is required' }));
      return;
    }

    const platform = detectPlatform(targetUrl);
    if (!platform || !API_ENDPOINTS[platform]) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'এই প্ল্যাটফর্মটি এখনো সমর্থিত নয়' }));
      return;
    }

    try {
      const upstreamUrl = `${API_ENDPOINTS[platform]}${encodeURIComponent(targetUrl)}`;
      const rawData = await fetchJson(upstreamUrl);
      const normalized = normalizeData(rawData, platform);

      if (!normalized) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'কোনো মিডিয়া ফাইল পাওয়া যায়নি। লিঙ্কটি প্রাইভেট হতে পারে অথবা সার্ভার মিডিয়া রিড করতে পারছে না।'
        }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: normalized }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message || 'সার্ভার থেকে রেসপন্স পেতে সমস্যা হয়েছে' }));
    }
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML_PAGE);
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
