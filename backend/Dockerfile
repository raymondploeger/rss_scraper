FROM node:22-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install

COPY backend/src ./backend/src
COPY frontend/public ./frontend/public

ENV HOST=0.0.0.0
ENV PORT=4000
ENV SQLITE_PATH=/app/data/rss-monitor.db

EXPOSE 4000

CMD ["npm", "--prefix", "backend", "start"]
