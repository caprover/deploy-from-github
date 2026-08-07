FROM node:22-alpine
LABEL org.opencontainers.image.source = "https://github.com/caprover/deploy-from-github"

RUN apk add --no-cache git \
 && npm i -g caprover@2.4.3 \
 && npm cache clean --force

COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["sh","/entrypoint.sh"]
