# Use Node.js runtime
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port 5000 (или порт, который использует ваш сервер)
EXPOSE 5000

# Start the server
CMD ["node", "index.js"] 