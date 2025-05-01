FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application code
COPY . .

# Expose port 8080 for the container
ENV PORT=8080
EXPOSE 8080

# Start the application
CMD ["node", "server.js"] 