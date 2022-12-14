FROM node:16.16.0-alpine3.16

LABEL org.opencontainers.image.source = "https://github.com/caprover/deploy-from-github"

RUN apk add --no-cache git \
 && npm i -g caprover \
 && npm cache clean --force

COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["sh","/entrypoint.sh"]
