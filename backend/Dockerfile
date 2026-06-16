FROM node:22-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./backend/
COPY backend/prisma ./backend/prisma
RUN cd backend && npm ci --omit=dev --no-audit --no-fund

COPY backend/src ./backend/src
COPY backend/data ./backend/data
COPY frontend/public ./frontend/public

ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "--prefix", "backend", "start"]
