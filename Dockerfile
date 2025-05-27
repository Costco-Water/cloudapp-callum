# Use official Node.js base image (choose version as needed)
FROM node:18

# Set working directory inside container
WORKDIR /app

# Copy package files first (leveraging Docker layer cache)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your app's code
COPY . .

# Expose app port (change if your app uses another)
EXPOSE 8080

# Start the app
CMD ["node", "index.js"]