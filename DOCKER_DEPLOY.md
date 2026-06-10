# Docker deploy tren VPS

## 1. Chuan bi

```bash
git clone https://github.com/dunqq99/streamapp.git
cd streamapp
cp .env.example .env
mkdir -p videos
```

Sua `.env`, toi thieu nen doi:

```env
DB_PASSWORD=mat-khau-mysql
MYSQL_ROOT_PASSWORD=mat-khau-root
NMS_SECRET_KEY=chuoi-bi-mat-rieng
SITE_URL=https://ten-mien-cua-ban.com
PUBLIC_API_URL=https://api.ten-mien-cua-ban.com
```

Dat video nguon vao:

```bash
videos/live.mp4
```

## 2. Chay

```bash
docker compose up -d --build
```

Kiem tra HLS:

```bash
curl http://localhost:8001/api/stream/status
curl http://localhost:8001/api/hls/main/index.m3u8
```

Mac dinh `STREAM_SOURCE=file`, server se phat lap `videos/live.mp4` thanh:

```text
/api/hls/main/index.m3u8
```

Frontend duoc build voi `VITE_STREAM_FORMAT=hls`, nen player se doc HLS truc tiep.

## 3. Doi video

Thay file:

```bash
videos/live.mp4
```

Khoi dong lai server:

```bash
docker compose restart server
```

## 4. Neu muon quay lai OBS/RTMP

Sua `.env`:

```env
STREAM_SOURCE=rtmp
VITE_STREAM_FORMAT=flv
```

Build lai client va server:

```bash
docker compose up -d --build
```

Publish RTMP vao:

```text
rtmp://YOUR_VPS_IP:1935/live/main
```
