FROM node:20-bookworm-slim AS build

WORKDIR /app

ARG VITE_API_URL
ARG VITE_STREAM_FORMAT=hls
ARG VITE_HLS_STREAM_NAME=obs_stream
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_STREAM_FORMAT=$VITE_STREAM_FORMAT
ENV VITE_HLS_STREAM_NAME=$VITE_HLS_STREAM_NAME

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

FROM nginx:1.27-alpine

COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
