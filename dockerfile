# specify the node base image with your desired version node:<version>
FROM node:alpine

ARG APP_DIR=app
RUN mkdir -p ${APP_DIR}
WORKDIR ${APP_DIR}

COPY package*.json ./
RUN npm install

COPY . .
# replace this with your application's default port
EXPOSE 3000

CMD ["npm", "run", "start"]