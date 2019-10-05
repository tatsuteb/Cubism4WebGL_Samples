FROM node:10.16.3-slim

WORKDIR /

COPY . /

RUN npm install
RUN npm i parcel-bundler -g

CMD ["npm", "run", "build"]
