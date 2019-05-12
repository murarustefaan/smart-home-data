ARG BASE_IMAGE="arm32v7/node:slim"

# Build container
FROM $BASE_IMAGE AS buildContainer
RUN mkdir /build
WORKDIR /build
COPY package-lock.json package-lock.json
COPY package.json package.json
RUN npm install --only=production
COPY . .

# Final container
FROM $BASE_IMAGE
RUN mkdir /service
WORKDIR /service
COPY --from=buildContainer /build  .
ENV NODE_ENV=production
CMD node index.js
