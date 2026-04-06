FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
ENV NODE_ENV=production
USER node
EXPOSE 8080
CMD ["node", "server.js"]
