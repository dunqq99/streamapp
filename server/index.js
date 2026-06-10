require('dotenv').config();
const NodeMediaServer = require('node-media-server');

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    allow_origin: '*',
    mediaroot: './media'
  },
  auth: {
    api: true,
    api_user: 'admin',
    api_pass: 'admin',
    play: true,
    publish: false,
    secret: process.env.NMS_SECRET_KEY || 'cpc-secret-2026'
  }
  // NOTE: trans block bị xóa có chủ ý.
  // FFmpeg được spawn thủ công trong postPublish để tránh dual-process conflict.
};

const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');
const SECRET_KEY = process.env.NMS_SECRET_KEY || 'cpc-secret-2026';
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const HLS_STREAM_NAME = process.env.HLS_STREAM_NAME || 'main';
const STREAM_SOURCE = (process.env.STREAM_SOURCE || 'rtmp').toLowerCase();
const SOURCE_VIDEO_PATH = process.env.SOURCE_VIDEO_PATH || '/videos/live.mp4';
const API_PORT = Number(process.env.PORT || 8001);

var nms = new NodeMediaServer(config)
nms.run();

let ffmpegProcess = null;
let fileHlsProcess = null;
let streamCleanupTimer = null;

function getHlsDir(streamName = HLS_STREAM_NAME) {
  return path.join(__dirname, 'media', 'live', streamName);
}

function resetHlsDir(streamName = HLS_STREAM_NAME) {
  const hlsDir = getHlsDir(streamName);
  if (fs.existsSync(hlsDir)) {
    fs.rmSync(hlsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(hlsDir, { recursive: true });
  return hlsDir;
}

function buildHlsArgs(input, outputFile, extraInputArgs = []) {
  return [
    '-y',
    ...extraInputArgs,
    '-i', input,
    '-c:v', process.env.HLS_VIDEO_CODEC || 'libx264',
    '-preset', process.env.HLS_PRESET || 'veryfast',
    '-tune', 'zerolatency',
    '-c:a', 'aac',
    '-ar', '44100',
    '-b:a', process.env.HLS_AUDIO_BITRATE || '128k',
    '-f', 'hls',
    '-hls_time', process.env.HLS_TIME || '2',
    '-hls_list_size', process.env.HLS_LIST_SIZE || '5',
    '-hls_flags', 'delete_segments+append_list+split_by_time',
    outputFile
  ];
}

function startFileHlsSource() {
  if (STREAM_SOURCE !== 'file') return;
  if (!fs.existsSync(SOURCE_VIDEO_PATH)) {
    console.error(`[FILE-HLS] Không tìm thấy video nguồn: ${SOURCE_VIDEO_PATH}`);
    return;
  }

  const hlsDir = resetHlsDir(HLS_STREAM_NAME);
  const outputFile = path.join(hlsDir, 'index.m3u8');
  const loopArgs = process.env.STREAM_LOOP === '0' ? [] : ['-stream_loop', '-1'];
  const realtimeArgs = process.env.STREAM_REALTIME === '0' ? [] : ['-re'];

  console.log(`[FILE-HLS] Phát ${SOURCE_VIDEO_PATH} -> /api/hls/${HLS_STREAM_NAME}/index.m3u8`);
  fileHlsProcess = spawn(FFMPEG_PATH, buildHlsArgs(SOURCE_VIDEO_PATH, outputFile, [...realtimeArgs, ...loopArgs]));

  fileHlsProcess.stderr.on('data', (data) => {
    console.log(`[FILE-HLS] ${data.toString()}`);
  });

  fileHlsProcess.on('close', (code) => {
    console.log(`[FILE-HLS] FFmpeg đã dừng (Code: ${code})`);
    fileHlsProcess = null;
    if (STREAM_SOURCE === 'file' && process.env.FILE_HLS_RESTART !== '0') {
      setTimeout(startFileHlsSource, 5000);
    }
  });
}

// Manually spawn FFmpeg to bypass NMS v4's missing trans module
nms.on('postPublish', (session) => {
  const streamPath = session.streamPath || '';
  if (streamPath.includes('/live/')) {
    console.log(`[FFMPEG] Nhận luồng: ${streamPath}. Đang khởi động bộ cắt HLS thủ công...`);
    
    const streamName = streamPath.split('/').pop();
    
    // Clear scheduled cleanup if OBS reconnects quickly
    if (streamCleanupTimer) clearTimeout(streamCleanupTimer);
    
    // Aggressively wipe old segments to prevent disk bloat (The 3GB / 100 files issue)
    const hlsDir = resetHlsDir(streamName);
    console.log(`[CLEANUP] Đã xóa cache cũ của luồng ${streamName} để tránh đầy ổ cứng.`);

    // Generate valid Auth Token for FFmpeg to bypass NMS Play Authentication
    const exp = (Date.now() / 1000 | 0) + 31536000; // Valid for 1 year
    const md5 = crypto.createHash('md5');
    const hashValue = md5.update(`${streamPath}-${exp}-${SECRET_KEY}`).digest('hex');
    const sign = `${exp}-${hashValue}`;

    ffmpegProcess = spawn(FFMPEG_PATH, [
      '-y',
      '-i', `rtmp://127.0.0.1:1935${streamPath}?sign=${sign}`,
      '-c:v', 'copy',
      '-c:a', 'aac', '-ar', '44100', '-b:a', '128k', '-strict', '-2',
      '-f', 'hls',
      '-hls_time', '2',
      '-hls_list_size', '3',
      '-hls_flags', 'delete_segments+split_by_time',
      path.join(hlsDir, 'index.m3u8')
    ]);

    ffmpegProcess.stderr.on('data', (data) => {
      console.log(`[FFMPEG LOG] ${data.toString()}`);
    });

    ffmpegProcess.on('close', (code) => {
      console.log(`[FFMPEG] Máy cắt HLS cho ${streamName} đã dừng (Code: ${code})`);
    });
  }
});

nms.on('donePublish', (session) => {
  const streamPath = session.streamPath || '';
  if (streamPath.includes('/live/')) {
    if (ffmpegProcess) {
      console.log(`[FFMPEG] Ngắt luồng ${streamPath}. Đang tắt máy cắt HLS...`);
      ffmpegProcess.kill('SIGKILL');
      ffmpegProcess = null;
    }
    
    // Dọn dẹp tệp tin 3 phút sau khi luồng kết thúc (Đảm bảo disk luôn trống khi không có live)
    const streamName = streamPath.split('/').pop();
    const hlsDir = path.join(__dirname, 'media', 'live', streamName);
    streamCleanupTimer = setTimeout(() => {
      if (fs.existsSync(hlsDir)) {
        try {
           fs.rmSync(hlsDir, { recursive: true, force: true });
           console.log(`[CLEANUP] Đã làm sạch hoàn toàn ổ đĩa cho luồng ${streamName} (Offline).`);
        } catch(e) {}
      }
    }, 3 * 60 * 1000);
  }
});

// ---- Express API for Scraper ----
const app = express();
app.use(cors());

app.use('/live', express.static(path.join(__dirname, 'media/live'), {
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));
app.use('/api/hls', express.static(path.join(__dirname, 'media/live'), {
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '365d',
  immutable: true
}));
const multer = require('multer');
const db = require('./db');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads/images');
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

let scheduleCache = null;
let lastFetchTime = 0;

const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());

let fetchSchedulePromise = null;

async function fetchSchedule() {
  if (!fetchSchedulePromise) {
    fetchSchedulePromise = _doFetchSchedule().finally(() => {
      fetchSchedulePromise = null;
    });
  }
  return fetchSchedulePromise;
}

async function _doFetchSchedule() {
  let browser = null;
  try {
    console.log('Fetching SV388 schedule...');
    browser = await puppeteerExtra.launch({ 
      headless: 'new', // new headless mode
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--proxy-server=http://117.0.73.91:47628',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--js-flags="--max-old-space-size=512"'
      ] 
    });
    const page = await browser.newPage();
    await page.authenticate({ username: 'hlQPNN', password: 'IDyFgi' });
    
    // SV388 is a heavy site, wait until DOM is loaded
    await page.goto('https://www.sv388.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for the schedule table element to populate its headers/rows
    await page.waitForSelector('#thisWeek tbody, table', { timeout: 15000 }).catch(() => console.log("Schedule table wait timeout"));
    
    // Additional wait to ensure dynamic data is loaded
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const scheduleHTML = await page.evaluate(() => {
        const el = document.querySelector('.game-schedule');
        return el ? el.innerHTML : null;
    });
    
    if (scheduleHTML && scheduleHTML.length > 100) {
      scheduleCache = scheduleHTML;
      lastFetchTime = Date.now();
      console.log('SV388 schedule updated successfully. Cache time:', new Date().toLocaleString());
    } else {
      console.log('Could not find scheduleHTML or it was too short.');
    }
  } catch (error) {
    console.error('Error fetching SV388 schedule:', error.message);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch(e) {
        console.error('Error closing Chromium:', e.message);
      }
    }
  }
}

// Initial fetch in background
fetchSchedule();

// Cron-like task: Automatically schedule a background fetch every 12 hours
// This ensures that when the "next day" comes, the cache is proactively updated
setInterval(() => {
  fetchSchedule();
}, 12 * 60 * 60 * 1000);

app.get('/api/schedule', async (req, res) => {
  // Check if cache is older than 24 hours (24 * 60 * 60 * 1000 = 86400000 ms)
  const isCacheExpired = (Date.now() - lastFetchTime) > 86400000;
  
  if (!scheduleCache || isCacheExpired) {
    // If we don't have cache, we Must wait for fetch. If we do, we can serve it and fetch in background.
    if (!scheduleCache) {
      await fetchSchedule();
    } else {
      // Async refresh
      fetchSchedule();
    }
  }
  
  if (scheduleCache) {
    res.json({ success: true, html: scheduleCache, lastUpdated: lastFetchTime });
  } else {
    res.status(500).json({ success: false, message: 'Failed to retrieve schedule' });
  }
});

// ---- Authentication Token API ----
app.get('/api/stream/token', (req, res) => {
  // Token validity: 5 minutes = 300 seconds
  const expireTime = Math.floor(Date.now() / 1000) + 300; 
  // NodeMediaServer hash format: {streamPath}-{expireTime}-{secret}
  const streamPath = `/live/${HLS_STREAM_NAME}`;
  
  const hashStr = `${streamPath}-${expireTime}-${SECRET_KEY}`;
  const md5Hash = crypto.createHash('md5').update(hashStr).digest('hex');
  
  const sign = `${expireTime}-${md5Hash}`;
  
  res.json({ success: true, sign });
});

app.get('/api/stream/status', (req, res) => {
  const playlistPath = path.join(getHlsDir(HLS_STREAM_NAME), 'index.m3u8');
  res.json({
    success: true,
    source: STREAM_SOURCE,
    streamName: HLS_STREAM_NAME,
    sourceVideoPath: STREAM_SOURCE === 'file' ? SOURCE_VIDEO_PATH : null,
    hlsReady: fs.existsSync(playlistPath),
    hlsUrl: `/api/hls/${HLS_STREAM_NAME}/index.m3u8`,
    fileHlsRunning: Boolean(fileHlsProcess),
    rtmpHlsRunning: Boolean(ffmpegProcess)
  });
});

// ---- Dynamic Sitemap ----
const SITE_URL = process.env.SITE_URL || 'https://dagacpc.live';

app.get('/sitemap.xml', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const staticUrls = [
    { loc: `${SITE_URL}/`,             changefreq: 'daily',   priority: '1.0' },
    { loc: `${SITE_URL}/tin-tuc`,      changefreq: 'daily',   priority: '0.8' },
    { loc: `${SITE_URL}/da-ga-cpc1`,   changefreq: 'daily',   priority: '0.9' },
    { loc: `${SITE_URL}/da-ga-cpc2`,   changefreq: 'daily',   priority: '0.9' },
    { loc: `${SITE_URL}/da-ga-cpc3`,   changefreq: 'daily',   priority: '0.9' },
    { loc: `${SITE_URL}/da-ga-cpc4`,   changefreq: 'daily',   priority: '0.9' },
    { loc: `${SITE_URL}/da-ga-cpc5`,   changefreq: 'daily',   priority: '0.8' },
    { loc: `${SITE_URL}/da-ga-cpc6`,   changefreq: 'daily',   priority: '0.8' },
  ];

  let articleUrls = [];
  try {
    const articles = await db.getArticles();
    articleUrls = articles
      .filter(a => a.category_slug && a.slug)
      .map(a => ({
        loc: `${SITE_URL}/${a.category_slug}/${a.slug}`,
        lastmod: a.created_at ? new Date(a.created_at).toISOString().split('T')[0] : today,
        changefreq: 'weekly',
        priority: '0.7',
      }));
  } catch (e) {
    console.error('[Sitemap] Lỗi lấy bài viết:', e.message);
  }

  const allUrls = [...staticUrls, ...articleUrls];

  const urlEntries = allUrls.map(u => `
  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod || today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlEntries}
</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

// ---- Admin Config API ----
const CONFIG_FILE = path.join(__dirname, 'config.json');

app.get('/api/config', (req, res) => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      res.json({ success: true, data: JSON.parse(data) });
    } else {
      res.status(404).json({ success: false, message: 'Config not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/verify-password', express.json(), (req, res) => {
  const { password } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || 'admin';
  res.json({ success: password === adminPass });
});

app.post('/api/config', express.json(), (req, res) => {
  const { password, data } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || 'admin';
  if (password !== adminPass) {
    return res.status(401).json({ success: false, message: 'Sai mật khẩu quản trị' });
  }
  
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
    if (typeof global.runAutoBot === 'function') global.runAutoBot();
    res.json({ success: true, message: 'Saved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---- Categories API ----
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await db.getCategories();
    res.json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/categories', express.json(), async (req, res) => {
  const { password, name, slug } = req.body;
  if (password !== (process.env.ADMIN_PASSWORD || 'admin')) return res.status(401).json({ success: false });
  try {
    const id = await db.addCategory(name, slug);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/categories/:id', express.json(), async (req, res) => {
  const { password, name, slug } = req.body;
  if (password !== (process.env.ADMIN_PASSWORD || 'admin')) return res.status(401).json({ success: false });
  try {
    await db.updateCategory(req.params.id, name, slug);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/categories/:id', express.json(), async (req, res) => {
  const { password } = req.body;
  if (password !== (process.env.ADMIN_PASSWORD || 'admin')) return res.status(401).json({ success: false });
  try {
    await db.deleteCategory(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---- Articles & File Upload API ----
app.post('/api/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  try {
    const filePath = req.file.path;
    const filenameWithoutExt = req.file.filename.split('.').slice(0, -1).join('.') || req.file.filename;
    const newFilename = `${filenameWithoutExt}_opt.webp`;
    const newFilePath = path.join(req.file.destination, newFilename);
    const metadata = await sharp(filePath).metadata();
    
    let sh = sharp(filePath);
    if (metadata.width > 500) {
       sh = sh.resize({ width: 500, withoutEnlargement: true });
    }
    
    await sh.webp({ quality: 80 }).toFile(newFilePath);
    fs.unlinkSync(filePath); // Cleanup original upload

    res.json({ success: true, url: '/uploads/images/' + newFilename });
  } catch (error) {
    console.error('Image optimization error:', error.message);
    // Fallback if compression fails
    const imageUrl = '/uploads/images/' + req.file.filename;
    res.json({ success: true, url: imageUrl });
  }
});

app.get('/api/articles', async (req, res) => {
  try {
    const articles = await db.getArticles(req.query.category);
    res.json({ success: true, articles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/articles/:catSlug/:slug', async (req, res) => {
  try {
    const { catSlug, slug } = req.params;
    const article = await db.getArticleBySlug(catSlug, slug);
    if (!article) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, article });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/articles', express.json(), async (req, res) => {
  const { password, ...article } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || 'admin';
  if (password !== adminPass) {
    return res.status(401).json({ success: false, message: 'Sai mật khẩu quản trị' });
  }
  try {
    const id = await db.addArticle(article);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/articles/:id', express.json(), async (req, res) => {
  const { password, ...article } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || 'admin';
  if (password !== adminPass) {
    return res.status(401).json({ success: false, message: 'Sai mật khẩu quản trị' });
  }
  try {
    const changes = await db.updateArticle(req.params.id, article);
    if(changes === 0) return res.status(404).json({ success: false, message: 'Article not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/articles/:id', express.json(), async (req, res) => {
  const { password } = req.body;
  const adminPass = process.env.ADMIN_PASSWORD || 'admin';
  if (password !== adminPass) {
    return res.status(401).json({ success: false, message: 'Sai mật khẩu quản trị' });
  }
  try {
    await db.deleteArticle(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---- Robots.txt ----
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml`);
});

// ---- Serve Client Static Files (with index.html bypassed for SEO Injection) ----
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  console.log(`[SEO Server] Đã kích hoạt phục vụ thư mục frontend tại: ${clientDistPath}`);
  app.use(express.static(clientDistPath, { index: false }));
}

// ---- Dynamic SEO & Schema Fallback Route ----
app.get('*', async (req, res, next) => {
  const parsedUrl = req.path;
  
  // Bỏ qua các API, tĩnh, media và socket.io requests
  if (parsedUrl.startsWith('/api') || 
      parsedUrl.startsWith('/uploads') || 
      parsedUrl.startsWith('/live') || 
      parsedUrl.startsWith('/socket.io') ||
      parsedUrl.includes('.')) {
    return next();
  }

  let htmlPath = path.join(__dirname, '../client/dist/index.html');
  if (!fs.existsSync(htmlPath)) {
    htmlPath = path.join(__dirname, '../client/index.html');
  }

  if (!fs.existsSync(htmlPath)) {
    return res.status(404).send('Không tìm thấy file index.html của frontend. Vui lòng build client trước.');
  }

  let htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Giá trị SEO mặc định
  let seoTitle = 'Đá Gà Trực Tiếp - Xem Trực Tiếp Đá Gà Thomo (CPC1 - CPC6) | DagaCPC.Live';
  let seoDesc = 'Xem trực tiếp đá gà Thomo mới nhất hôm nay: cpc1, cpc2, cpc3, cpc4, cpc5, cpc6 tại dagacpc.live. Đường truyền tốc độ cao, không giật lag.';
  let seoKeywords = 'đá gà trực tiếp, đá gà cpc1, đá gà cpc2, đá gà cpc3, đá gà cpc4, đá gà cpc5, đá gà cpc6, dagacpc.live';
  let seoImage = 'https://api.dagacpc.live/favicon.svg';
  let schemaJson = null;

  try {
    // Dạng 1: Bài viết chi tiết /:categorySlug/:articleSlug
    const articleMatch = parsedUrl.match(/^\/([^/]+)\/([^/]+)$/);
    // Dạng 2: Danh mục hoặc kênh /:slug
    const singleMatch = parsedUrl.match(/^\/([^/]+)$/);

    if (articleMatch) {
      const categorySlug = articleMatch[1];
      const articleSlug = articleMatch[2];
      
      if (categorySlug !== 'admin' && categorySlug !== 'tin-tuc') {
        const article = await db.getArticleBySlug(categorySlug, articleSlug);
        if (article) {
          seoTitle = `${article.title} - Kiến Thức Đá Gà | DagaCPC.Live`;
          const plainContent = article.content ? article.content.replace(/<[^>]*>/g, '').trim() : '';
          seoDesc = plainContent.substring(0, 155) + '...';
          if (article.image_url) {
            seoImage = `https://api.dagacpc.live${article.image_url}`;
          }
          
          // Generate NewsArticle JSON-LD Schema
          schemaJson = {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            "headline": article.title,
            "description": seoDesc,
            "image": [seoImage],
            "datePublished": article.created_at || new Date().toISOString(),
            "dateModified": article.created_at || new Date().toISOString(),
            "author": [{
              "@type": "Person",
              "name": "BTV DagaCPC",
              "url": "https://dagacpc.live"
            }],
            "publisher": {
              "@type": "Organization",
              "name": "DagaCPC.Live",
              "logo": {
                "@type": "ImageObject",
                "url": "https://api.dagacpc.live/favicon.svg"
              }
            },
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": `${SITE_URL}${parsedUrl}`
            }
          };
        }
      }
    } else if (singleMatch) {
      const slug = singleMatch[1];
      if (slug !== 'admin' && slug !== 'tin-tuc') {
        // Tra cứu config.json
        let seoDictionary = null;
        if (fs.existsSync(CONFIG_FILE)) {
          try {
            const configObj = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            seoDictionary = configObj?.seoDictionary;
          } catch(e) {}
        }
        
        let channelKey = 'HOME';
        const matchCpc = slug.match(/^truc-tiep-da-ga-(cpc[1-6])$/i);
        if (matchCpc) {
          channelKey = matchCpc[1].toUpperCase();
        } else {
          // Check categories
          try {
            const categories = await db.getCategories();
            const isCat = categories.some(c => c.slug === slug);
            if (isCat) {
              seoTitle = `Danh Mục ${slug.toUpperCase()} - Trực Tiếp Đá Gà CPC | DagaCPC.Live`;
              seoDesc = `Các bài viết tin tức, hướng dẫn và kiến thức hữu ích về danh mục ${slug} tại dagacpc.live.`;
            }
          } catch(e) {}
        }

        if (seoDictionary && seoDictionary[channelKey]) {
          const dictData = seoDictionary[channelKey];
          seoTitle = dictData.metaTitle || seoTitle;
          seoDesc = dictData.metaDesc || seoDesc;
          
          // Generate Video LiveStream Schema
          schemaJson = {
            "@context": "https://schema.org",
            "@type": "VideoObject",
            "name": dictData.title || seoTitle,
            "description": seoDesc,
            "thumbnailUrl": [seoImage],
            "uploadDate": new Date().toISOString(),
            "contentUrl": `${SITE_URL}${parsedUrl}`,
            "embedUrl": `${SITE_URL}${parsedUrl}`,
            "publication": {
              "@type": "BroadcastEvent",
              "isLiveBroadcast": true,
              "startDate": new Date().toISOString(),
              "endDate": new Date(Date.now() + 8 * 3600000).toISOString()
            }
          };
        }
      }
    } else if (parsedUrl === '/') {
      let seoDictionary = null;
      if (fs.existsSync(CONFIG_FILE)) {
        try {
          const configObj = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
          seoDictionary = configObj?.seoDictionary;
        } catch(e) {}
      }
      if (seoDictionary && seoDictionary['HOME']) {
        const dictData = seoDictionary['HOME'];
        seoTitle = dictData.metaTitle || seoTitle;
        seoDesc = dictData.metaDesc || seoDesc;
      }
    }
  } catch (err) {
    console.error('[SEO Injection Error]:', err.message);
  }

  // Thay thế Meta tags trong HTML
  htmlContent = htmlContent.replace(/<title>[^<]*<\/title>/i, `<title>${seoTitle}</title>`);
  
  if (htmlContent.includes('name="description"')) {
    htmlContent = htmlContent.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${seoDesc}" />`);
  } else {
    htmlContent = htmlContent.replace('</head>', `<meta name="description" content="${seoDesc}" />\n</head>`);
  }

  // Inject OpenGraph và JSON-LD
  const ogAndSchemaTags = `
    <meta property="og:title" content="${seoTitle}" />
    <meta property="og:description" content="${seoDesc}" />
    <meta property="og:image" content="${seoImage}" />
    <meta property="og:url" content="${SITE_URL}${parsedUrl}" />
    <meta property="og:type" content="website" />
    <meta name="keywords" content="${seoKeywords}" />
    <link rel="canonical" href="${SITE_URL}${parsedUrl}" />
    ${schemaJson ? `<script type="application/ld+json" id="seo-server-schema">${JSON.stringify(schemaJson)}</script>` : ''}
  `;
  
  htmlContent = htmlContent.replace('</head>', `${ogAndSchemaTags}\n</head>`);

  res.send(htmlContent);
});

const { Server } = require("socket.io");

const server = app.listen(API_PORT, () => {
  console.log(`Express API Server running on port ${API_PORT}`);
  startFileHlsSource();
});

// ---- Socket.IO for Live Chat ----
const io = new Server(server, {
  cors: {
    origin: "*", // allow frontends to connect
    methods: ["GET", "POST"]
  }
});

let chatHistory = []; // temporary cache for the last 50 messages
let bannedUsers = []; // array of banned usernames

io.on("connection", (socket) => {
  // Send current history down to new connections
  socket.emit("chatHistory", chatHistory);

  socket.on("chatMessage", (msg) => {
    // Check ban list
    if (bannedUsers.includes(msg.username)) {
      return socket.emit("chatError", "Tài khoản của bạn đã bị cấm chat.");
    }
    
    // Assign unique ID to message for moderation
    msg.id = crypto.randomUUID();
    msg.timestamp = Date.now();

    // Save to memory
    chatHistory.push(msg);
    if (chatHistory.length > 50) {
      chatHistory.shift();
    }
    // Broadcast to everyone including the sender
    io.emit("chatMessage", msg);
  });

  // Admin moderation events (in real prod, should verify admin token)
  socket.on("deleteMessage", ({ messageId, adminPassword }) => {
    if (adminPassword === (process.env.ADMIN_PASSWORD || 'admin')) {
      chatHistory = chatHistory.filter((m) => m.id !== messageId);
      io.emit("messageDeleted", messageId);
    }
  });

  socket.on("clearChat", ({ adminPassword }) => {
    if (adminPassword === (process.env.ADMIN_PASSWORD || 'admin')) {
      chatHistory = [];
      io.emit("chatCleared");
    }
  });

  socket.on("banUser", ({ username, adminPassword }) => {
    if (adminPassword === (process.env.ADMIN_PASSWORD || 'admin')) {
      if (!bannedUsers.includes(username)) {
        bannedUsers.push(username);
      }
      chatHistory = chatHistory.filter((m) => m.username !== username);
      io.emit("userBanned", username);
    }
  });

  socket.on("injectFakeChat", ({ adminPassword, username, text, level }) => {
    if (adminPassword === (process.env.ADMIN_PASSWORD || 'admin')) {
      const uName = username?.trim() || `Khach${Math.floor(Math.random() * 9999)}`;
      const msg = {
        id: crypto.randomUUID(),
        author: uName,
        username: uName,
        level: level || Math.floor(Math.random() * 5) + 1,
        text: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      chatHistory.push(msg);
      if (chatHistory.length > 50) chatHistory.shift();
      io.emit("chatMessage", msg);
    }
  });
});

// ---- Auto Bot Multi-Threaded Orchestrator ----
class AutoBotManager {
  constructor() {
    this.thread1 = null;
    this.thread2 = null;
    this.thread3 = null;
    this.configObj = null;
    this.linesHeartbeat = [];
    this.linesBurst = [];
    this.linesKickoff = [];
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        this.configObj = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        if (this.configObj?.settings?.botEnabled === true || String(this.configObj?.settings?.botEnabled) === 'true') {
          
          const scriptB = this.configObj?.settings?.botScript || '';
          this.linesBurst = scriptB.split('\n').filter(l => l.trim().length > 0);

          const scriptH = this.configObj?.settings?.botScriptHeartbeat || '';
          this.linesHeartbeat = scriptH.split('\n').filter(l => l.trim().length > 0);

          const scriptK = this.configObj?.settings?.botScriptKickoff || '';
          this.linesKickoff = scriptK.split('\n').filter(l => l.trim().length > 0);

          return this.linesBurst.length > 0 || this.linesHeartbeat.length > 0 || this.linesKickoff.length > 0;
        }
      }
    } catch (e) {
      console.error('AutoBot Load Config Error:', e.message);
    }
    return false;
  }

  sendMsgToChat(text, author, level) {
    try {
      const msg = {
        id: 'bot_' + Date.now() + '_' + Math.floor(Math.random()*1000),
        author: author,
        username: author,
        level: level,
        text: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      if (Array.isArray(chatHistory)) {
        chatHistory.push(msg);
        if (chatHistory.length > 50) chatHistory.shift();
      }
      if (io) {
        io.emit("chatMessage", msg);
      }
    } catch (e) {
      console.error('SendMsg Error:', e.message);
    }
  }

  getRandomAuthor() {
    const allLines = [...this.linesHeartbeat, ...this.linesBurst, ...this.linesKickoff];
    if (allLines.length === 0) return { author: `Khach${Math.floor(Math.random()*9999)}`, level: 5 };
    const randLine = allLines[Math.floor(Math.random() * allLines.length)];
    const parts = randLine.split('|');
    return {
      author: parts[1] ? parts[1].trim() : `Khach${Math.floor(Math.random()*9999)}`,
      level: parts[2] ? parseInt(parts[2].trim()) : (Math.floor(Math.random() * 10) + 1)
    };
  }

  // Luồng 1: Heartbeat thưa thớt hơn (Thay vì 30s cố định, giờ là 45s đến 120s)
  runThread1(immediate = false) {
    clearTimeout(this.thread1);
    const delay = immediate ? 2000 : Math.floor(Math.random() * 75000) + 45000;
    this.thread1 = setTimeout(() => {
      try {
        if (!this.loadConfig() || this.linesHeartbeat.length === 0) return;
        const line = this.linesHeartbeat[Math.floor(Math.random() * this.linesHeartbeat.length)];
        const parts = line.split('|');
        const rAuthor = this.getRandomAuthor();
        this.sendMsgToChat(
          parts[0] ? parts[0].trim() : 'Gà hay đá đẹp!',
          rAuthor.author,
          rAuthor.level
        );
      } finally {
         this.runThread1(false);
      }
    }, delay);
  }

  // Luồng 2: Cụm Burst (1-3 tin) theo cài đặt User
  runThread2(immediate = false) {
    clearTimeout(this.thread2);
    if (!this.loadConfig()) return;
    
    let minD = parseInt(this.configObj.settings.botMinDelay) || 10;
    let maxD = parseInt(this.configObj.settings.botMaxDelay) || 30;
    if (minD > maxD) { const t = minD; minD = maxD; maxD = t; }

    const nextDelay = immediate ? 1500 : Math.floor(Math.random() * ((maxD - minD)*1000 + 1)) + minD*1000;
    
    this.thread2 = setTimeout(() => {
      try {
        if (!this.loadConfig() || this.linesBurst.length === 0) return;
        
        // Bốc ngẫu nhiên 1 cụm kịch bản Burst
        const mainLine = this.linesBurst[Math.floor(Math.random() * this.linesBurst.length)];
        const parts = mainLine.split('|');
        const rAuthor = this.getRandomAuthor();
        
        // Tách các tin nhắn liên tiếp bằng dấu / nếu có
        const texts = parts[0] ? parts[0].split('/').map(t => t.trim()).filter(t => t.length > 0) : ['Chuẩn'];
        
        let cumulativeDelay = 0;
        texts.forEach((txt, idx) => {
           // Giả lập tốc độ gõ phím CHẬM và thực tế hơn: chờ 8-15 giây giữa các mảnh tin nhắn
           const typingTime = Math.max(8000, txt.length * 200) + Math.floor(Math.random() * 7000);
           cumulativeDelay += idx === 0 ? 0 : typingTime;
           setTimeout(() => this.sendMsgToChat(txt, rAuthor.author, rAuthor.level), cumulativeDelay);
        });
        
        setTimeout(() => this.runThread2(false), cumulativeDelay + 500);
      } catch (e) {
        console.error('Thread 2 err', e);
        this.runThread2(false);
      }
    }, nextDelay);
  }

  // Luồng 3: Kickoff Wave (Rất lâu mới có 1 đợt ồ ạt: 3 - 6 phút một lần)
  runThread3(immediate = false) {
    clearTimeout(this.thread3);
    const nextDelay = immediate ? 3000 : Math.floor(Math.random() * 180000) + 180000; // 180s - 360s
    this.thread3 = setTimeout(() => {
      try {
        if (!this.loadConfig() || this.linesKickoff.length === 0) return;
        const waveCount = Math.floor(Math.random() * 4) + 3; // 3 to 6 comments
        
        let cumulativeDelay = 0;
        for (let i=0; i<waveCount; i++) {
           const eLine = this.linesKickoff[Math.floor(Math.random() * this.linesKickoff.length)];
           const parts = eLine.split('|');
           const txt = parts[0] ? parts[0].trim() : 'Hay quá!';
           const rAuthor = this.getRandomAuthor();
           
           // Tăng độ trễ tản ra thật thưa: 5 - 15 giây mới nổ 1 tin trong đợt sóng
           cumulativeDelay += Math.floor(Math.random() * 10000) + 5000;
           setTimeout(() => this.sendMsgToChat(txt, rAuthor.author, rAuthor.level), cumulativeDelay);
        }
      } finally {
        setTimeout(() => this.runThread3(false), 5000); // 5s padding before scheduling next global wave
      }
    }, nextDelay);
  }

  start(immediate = false) {
    if (this.loadConfig()) {
      this.runThread1(immediate);
      this.runThread2(immediate);
      this.runThread3(immediate);
    } else {
      clearTimeout(this.thread1);
      clearTimeout(this.thread2);
      clearTimeout(this.thread3);
    }
  }
}

const botOrchestrator = new AutoBotManager();
botOrchestrator.start(false);
global.runAutoBot = () => botOrchestrator.start(true);

// ---- Graceful Shutdown to Prevent Zombie Processes (FFmpeg / Puppeteer) ----
function shutdown() {
  console.log('[SYSTEM] Node.js process terminating... Cleaning up.');
  if (ffmpegProcess) {
    try {
      ffmpegProcess.kill('SIGKILL');
      console.log('[SYSTEM] FFmpeg child process killed.');
    } catch (e) {
      console.error('[SYSTEM] Error killing FFmpeg:', e.message);
    }
  }
  if (fileHlsProcess) {
    try {
      fileHlsProcess.kill('SIGKILL');
      console.log('[SYSTEM] File HLS FFmpeg child process killed.');
    } catch (e) {
      console.error('[SYSTEM] Error killing File HLS FFmpeg:', e.message);
    }
  }
  // Allow pending connections to close before exiting
  setTimeout(() => process.exit(0), 1500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
