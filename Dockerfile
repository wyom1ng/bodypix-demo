FROM node:current-alpine3.10 as builder

WORKDIR /usr/src/app

COPY . .

RUN npm ci && npm run build -- --prod

FROM nginx:stable-alpine

WORKDIR /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /usr/src/app/dist/bodypix-demo .
