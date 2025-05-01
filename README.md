# Voiceflow Knowledge Base Backend

A simple Express server that proxies requests to the Voiceflow Knowledge Base API.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file with your configuration (see `.env.example`).

3. Start the server:
   ```
   npm start
   ```

   Or for development with auto-restart:
   ```
   npm run dev
   ```

## Docker Deployment

1. Build the Docker image:
   ```
   docker build -t vf-backend-processing .
   ```

2. Run the container:
   ```
   docker run -p 8080:8080 vf-backend-processing
   ```

   The server will be accessible at http://localhost:8080

## API Usage

### Query Voiceflow Knowledge Base

**Endpoint:** `POST /api/knowledge-query`

**Request Body:**
```json
{
  "apiKey": "your-voiceflow-api-key",
  "lastUtterance": "your query text"
}
```

**Response:**
```json
{
  "answer": "1. Source Name – Source URL\n2. Another Source – Another URL",
  "rawResponse": {
    // Original Voiceflow response
  },
  "output": "The output text from Voiceflow"
}
```

### Health Check

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "ok"
}
```

## Error Handling

The API returns appropriate error codes and messages when:
- API key is missing
- Last utterance is missing
- Voiceflow API returns an error 