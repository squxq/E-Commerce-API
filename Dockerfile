FROM node:alpine

RUN mkdir -p /usr/src/e-commerce-api && chown -R node:node /usr/src/e-commerce-api

WORKDIR /usr/src/e-commerce-api

COPY package.json yarn.lock ./

USER node

RUN yarn install --pure-lockfile

COPY --chown=node:node . .

EXPOSE 5000
