FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite bakes VITE_* vars into the bundle at build time — must arrive as
# build args (docker-compose.yml's frontend.build.args), not env_file.
ARG VITE_GOOGLE_CLIENT_ID=
ARG VITE_DETECTOR_JN_URL=
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_DETECTOR_JN_URL=$VITE_DETECTOR_JN_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
