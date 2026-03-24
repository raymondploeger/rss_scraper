FROM node:22-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./backend/
COPY backend/prisma ./backend/prisma
RUN cd backend && npm install

COPY backend/src ./backend/src
COPY frontend/public ./frontend/public

ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "--prefix", "backend", "start"]
