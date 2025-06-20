# Use Node.js as the base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose ports for both client and server
EXPOSE 3000 5000

# Start both client and server using the dev script
CMD ["npm", "run", "dev"] 