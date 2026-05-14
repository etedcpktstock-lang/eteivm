# Use Node.js 22 LTS slim image
FROM node:22-slim

# Install openssl for Prisma
RUN apt-get update -y && apt-get install -y openssl

# Create and change to the app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy local code to the container image
COPY . .

# Generate Prisma client (crucial for Cloud Run)
RUN npx prisma generate

# Build the TypeScript app
RUN npm run build

# Expose the port (Cloud Run uses PORT env var)
EXPOSE 3001

# Run the web service on container startup
CMD [ "npm", "start" ]
