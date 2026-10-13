FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["sh", "-c", "npx drizzle-kit push && npm run start"]
