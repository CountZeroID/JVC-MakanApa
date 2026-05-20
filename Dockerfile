# Stage 1: Build the Vite React App
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
# Hapus package-lock untuk mencegah bug native binding Tailwind di Alpine
RUN rm -f package-lock.json && npm install
COPY . .
# API key harus tersedia saat build karena Vite embed nilainya ke bundle
ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY
RUN npm run build

# Stage 2: Serve using NGINX
FROM nginx:alpine
# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy built static files
COPY --from=build /app/dist /usr/share/nginx/html

# Cloud Run specific port
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
