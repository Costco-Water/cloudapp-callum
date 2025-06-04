FROM node:18
WORKDIR /app
COPY package*.json ./
COPY . .
RUN mkdir -p ssl
COPY ssl/private.key ssl/
COPY ssl/certificate.pem ssl/
RUN npm install
EXPOSE 8443
CMD ["node", "index.js"]