# Stage 1: Build React frontend
FROM node:24-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Node.js image
FROM node:24-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist ./frontend-dist

RUN mkdir -p uploads

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "src/index.js"]
