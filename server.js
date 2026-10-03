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

// CapCut-এর জন্য নিজস্ব ডিরেক্ট স্ক্র্যাপার (ওয়াটারমার্ক ছাড়া আসল ভিডিও ও কভার নেওয়ার জন্য)
function scrapeCapCut(targetUrl) {
  return new Promise((resolve, reject) => {
    const getOptions = (reqUrl) => ({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const handleReq = (reqUrl) => {
      https.get(reqUrl, getOptions(reqUrl), (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return handleReq(res.headers.location);
        }

        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            let videoUrl = null;
            let cover = null;
            let title = 'CapCut Video (No Watermark)';

            // 1. JSON ডেটা খোঁজা (__NEXT_DATA__ বা টেমপ্লেট মেটাডেটা)
            const jsonMatch = body.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
            if (jsonMatch) {
              try {
                const parsedData = JSON.parse(jsonMatch[1]);
                const pageProps = parsedData?.props?.pageProps || {};
                const template = pageProps.template || pageProps.detail || {};
                videoUrl = template.video_url || template.play_url;
                cover = template.cover_url || template.poster_url;
                title = template.title || title;
              } catch (err) {}
            }

            // 2. সরাসরি HTML-এ ByteDance/TikTok CDN ভিডিও লিঙ্ক খোঁজা
            if (!videoUrl) {
              const mp4Matches = body.match(/https:\/\/[^"'\s]+?\.mp4[^"'\s]*/g);
              if (mp4Matches && mp4Matches.length > 0) {
                // ল্যান্ডিং ভিডিও বাদে আসল টেমপ্লেট ভিডিও নেওয়া
                videoUrl = mp4Matches.find(m => !m.includes('cc_landing')) || mp4Matches[0];
              }
            }

            // 3. কভার ছবি খোঁজা
            if (!cover) {
              const ogImage = body.match(/<meta property="og:image" content="([^"]+)"/);
              if (ogImage) cover = ogImage[1];
            }

            const titleMatch = body.match(/<title>([^<]+)<\/title>/);
            if (titleMatch && !titleMatch[1].includes('CapCut')) {
              title = titleMatch[1];
            }

            if (!videoUrl) {
              return reject(new Error('CapCut ভিডিও লিঙ্ক খুঁজে পাওয়া যায়নি। লিঙ্কটি পাবলিক কিনা নিশ্চিত করুন।'));
            }

            resolve({
              title,
              author: 'CapCut Creator',
              thumbnail: cover,
              downloads: [
                {
                  label: 'Download Video (No Watermark MP4)',
                  url: videoUrl,
                  type: 'video'
                }
              ]
            });
          } catch (e) {
            reject(new Error('CapCut প্রসেস করতে ব্যর্থ হয়েছে'));
          }
        });
      }).on('error', reject);
    };

    handleReq(targetUrl);
  });
}

function classifyUrl(mediaUrl) {
  const u = (mediaUrl || '').toLowerCase();
  if (u.includes('.mp4') || u.includes('video') || u.includes('mime=video') || u.includes('bytestart=')) {
    return 'video';
  }
  if (u.includes('.mp3') || u.includes('audio') || u.includes('mime=audio')) {
    return 'audio';
  }
  if (u.includes('.jpg') || u.includes('.jpeg') || u.includes('.png') || u.includes('.webp') || u.includes('image')) {
    return 'image';
  }
  return 'unknown';
}

function normalizeData(raw, platform) {
  const d = (raw && raw.data) ? raw.data : raw;
  if (!d) return null;

  const downloads = [];
  let thumbnail = d.thumbnail || d.cover || d.image || d.poster || null;
  const title = d.title || d.caption || `${platform ? platform.toUpperCase() : 'Social Media'} File`;
  const author = d.author || d.creator || d.channel || null;

  // 1. Object downloads: { video: [...], audio: [...] }
  if (d.downloads && typeof d.downloads === 'object' && !Array.isArray(d.downloads)) {
    if (Array.isArray(d.downloads.video)) {
      d.downloads.video.forEach((v, idx) => {
        const u = typeof v === 'string' ? v : (v && v.url);
        if (u) downloads.push({ label: `Download Video ${idx + 1} (MP4)`, url: u, type: 'video' });
      });
    }
    if (Array.isArray(d.downloads.audio)) {
      d.downloads.audio.forEach((a, idx) => {
        const u = typeof a === 'string' ? a : (a && a.url);
        if (u) downloads.push({ label: `Download Audio ${idx + 1} (MP3)`, url: u, type: 'audio' });
      });
    }
  }

  // 2. Array downloads
  if (Array.isArray(d.downloads)) {
    d.downloads.forEach(dl => {
      const u = typeof dl === 'string' ? dl : (dl && dl.url);
      if (u) {
        const guessed = classifyUrl(u);
        const type = dl.type || (guessed === 'audio' ? 'audio' : 'video');
        downloads.push({ label: dl.title || (type === 'audio' ? 'Download Audio (MP3)' : 'Download Video (MP4)'), url: u, type });
      }
    });
  }

  // 3. Direct fields
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

      const guessedType = classifyUrl(mediaUrl);
      const isVideo = guessedType === 'video' || (m.type && m.type.includes('video'));

      if (isVideo) {
        downloads.push({
          label: `Download Video ${idx + 1} (MP4)`,
          url: mediaUrl,
          type: 'video'
        });
      } else {
        downloads.push({
          label: `Download Image ${idx + 1}`,
          url: mediaUrl,
          type: 'image'
        });
        if (!thumbnail) {
          thumbnail = mediaUrl;
        }
      }
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
  <title>Universal Social Media Downloader</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body { background: radial-gradient(circle at top, #1e1b4b, #0f172a, #020617); min-height: 100vh; }
  </style>
</head>
<body class="text-slate-100 flex flex-col min-h-screen p-4 sm:p-6 justify-center items-center">
  <div class="w-full max-w-xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl my-auto">
    <div class="text-center mb-6">
      <div class="inline-flex items-center justify-center w-14 h-14 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-2xl mb-3 text-2xl">
        <i class="fa-solid fa-cloud-arrow-down"></i>
      </div>
      <h1 class="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
        সোশ্যাল মিডিয়া ডাউনলোডার
      </h1>
      <p class="text-slate-400 text-xs sm:text-sm mt-1">CapCut, TikTok, Facebook, Instagram, Spotify, YouTube ইত্যাদি</p>
    </div>

    <div class="flex flex-col gap-3">
      <div class="relative">
        <i class="fa-solid fa-link absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
        <input id="urlInput" type="text" placeholder="এখানে ভিডিও বা অডিওর লিঙ্ক পেস্ট করুন..."
          class="w-full pl-11 pr-4 py-3.5 bg-slate-950/70 border border-slate-700/80 rounded-2xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner text-sm">
      </div>
      <button id="downloadBtn" onclick="processUrl()"
        class="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-medium py-3.5 rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30">
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

      <!-- 1. Cover / Image Section -->
      <div id="coverSection" class="hidden flex flex-col items-center bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
        <span class="text-xs font-semibold text-slate-400 mb-2.5 uppercase tracking-wider flex items-center gap-1.5">
          <i class="fa-solid fa-image text-indigo-400"></i> কভার ছবি / ইমেজ
        </span>
        <img id="thumbImg" src="" alt="Cover" class="w-full max-w-xs max-h-72 object-contain rounded-xl shadow-lg border border-slate-700/50 mb-3 bg-black/40">
        <a id="thumbDl" href="#" target="_blank" download="media.jpg"
           class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-5 py-2.5 rounded-xl font-medium shadow transition">
          <i class="fa-solid fa-download"></i> Download Cover / Image
        </a>
      </div>

      <!-- 2. Video Player Section -->
      <div id="videoSection" class="hidden flex flex-col items-center bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
        <span class="text-xs font-semibold text-slate-400 mb-2.5 uppercase tracking-wider flex items-center gap-1.5">
          <i class="fa-solid fa-play text-emerald-400"></i> ভিডিও প্লেয়ার
        </span>
        <video id="videoPlayer" controls playsinline class="w-full max-h-80 rounded-xl bg-black mb-3 shadow"></video>
        <div id="videoButtons" class="flex flex-wrap gap-2 justify-center w-full"></div>
      </div>

      <!-- 3. Audio Player Section -->
      <div id="audioSection" class="hidden flex flex-col items-center bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
        <span class="text-xs font-semibold text-slate-400 mb-2.5 uppercase tracking-wider flex items-center gap-1.5">
          <i class="fa-solid fa-music text-sky-400"></i> অডিও প্লেয়ার
        </span>
        <audio id="audioPlayer" controls class="w-full mb-3"></audio>
        <div id="audioButtons" class="flex flex-wrap gap-2 justify-center w-full"></div>
      </div>

      <!-- 4. Other Section -->
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
        showStatus('ত্রুটি: ' + (err.message || 'মিডিয়া লোড করা যায়নি।'), 'bg-rose-500/20 text-rose-300 border border-rose-500/30');
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
      document.getElementById('mediaAuthor').innerText = data.author ? 'শিল্পী/ইউজার: ' + data.author : '';

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
          btn.className = 'bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow';
          btn.innerHTML = '<i class="fa-solid fa-music"></i> ' + a.label;
          audioBtns.appendChild(btn);
        });
        audioSection.classList.remove('hidden');
      } else if (videoList.length > 0) {
        audioPlayer.src = videoList[0].url;
        const btn = document.createElement('a');
        btn.href = videoList[0].url;
        btn.target = '_blank';
        btn.className = 'bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow';
        btn.innerHTML = '<i class="fa-solid fa-music"></i> Play / Stream Audio Track';
        audioBtns.appendChild(btn);
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
    if (!platform) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'এই প্ল্যাটফর্মটি এখনো সমর্থিত নয়' }));
      return;
    }

    // CapCut-এর জন্য নিজস্ব ডিরেক্ট স্ক্র্যাপার কল
    if (platform === 'capcut') {
      try {
        const capcutData = await scrapeCapCut(targetUrl);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: capcutData }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message || 'CapCut ভিডিও প্রসেস করা সম্ভব হয়নি' }));
      }
      return;
    }

    // বাকি সব প্ল্যাটফর্মের জন্য স্বাভাবিক প্রসেসিং
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
