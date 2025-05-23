import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Function to extract title from HTML
async function extractTitleFromUrl(url) {
  try {
    if (!url) return "Untitled";
    
    const response = await axios.get(url, {
      timeout: 5000, // 5 second timeout to avoid long delays
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      }
    });
    
    const html = response.data;
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    
    return titleMatch ? titleMatch[1].trim() : "Untitled";
  } catch (error) {
    console.error(`Error fetching title from ${url}:`, error.message);
    return "Untitled";
  }
}

// Endpoint to query Voiceflow knowledge base
app.post('/api/knowledge-query', async (req, res) => {
  try {
    const { apiKey, lastUtterance } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    if (!lastUtterance) {
      return res.status(400).json({ error: 'Last utterance is required' });
    }

    const voiceflowResponse = await axios.post(
      'https://general-runtime.voiceflow.com/knowledge-base/query',
      {
        question: `{${lastUtterance}}`,
        settings: {
          model: "gpt-4o-mini",
          temperature: 0.2
        },
        chunkLimit: 2
      },
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': apiKey
        }
      }
    );

    // Process the response similar to the main function provided
    const chunks = voiceflowResponse.data.chunks || [];
    
    // Extract unique URLs first to avoid duplicates
    const uniqueUrls = new Set();
    const uniqueSources = [];
    
    chunks.forEach(chunk => {
      const url = chunk?.source?.url || "";
      if (url && !uniqueUrls.has(url)) {
        uniqueUrls.add(url);
        uniqueSources.push({ url, source: chunk.source });
      }
    });
    
    // Extract titles from unique URLs
    const results = [];
    for (let i = 0; i < uniqueSources.length; i++) {
      const { url } = uniqueSources[i];
      
      // Use URL to fetch the page title
      const title = await extractTitleFromUrl(url);
      results.push(`${i + 1}. ${title || "Untitled"}\n   ${url}`);
    }
    
    const resultList = results.join("\n\n");

    // Format the response
    const formattedResponse = {
      answer: resultList || "Sorry, I couldn't find any matching pages.",
      rawResponse: voiceflowResponse.data,
      output: voiceflowResponse.data.output
    };

    res.json(formattedResponse);
  } catch (error) {
    console.error('Error querying Voiceflow KB:', error.message);
    res.status(500).json({ 
      error: 'Failed to query Voiceflow knowledge base',
      details: error.message
    });
  }
});

// Endpoint to get transcript URL by session ID
app.get('/api/transcript-url', async (req, res) => {
  try {
    const { apiKey, projectId, sessionId, string, html } = req.query;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    if (!sessionId) {
      // Return 200 with error message when session ID is missing
      if (html === 'true') {
        const noSessionHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; text-align: center;">
          <h2 style="margin-bottom: 20px; color: #444;">Missing Session ID</h2>
          <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
            No session ID was provided. Please include a valid session ID to view the transcript.
          </p>
        </div>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        return res.send(noSessionHtml);
      }
      
      // Return JSON with error message but status 200
      return res.status(200).json({ 
        success: false,
        error: 'No session ID was provided',
        message: 'Please provide a valid session ID to view the transcript'
      });
    }

    // Make a request to Voiceflow Transcripts API
    const voiceflowResponse = await axios.get(
      `https://api.voiceflow.com/v2/transcripts/${projectId}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': apiKey
        }
      }
    );

    // Find the transcript with the matching sessionID
    const transcripts = voiceflowResponse.data;
    const matchingTranscript = transcripts.find(transcript => transcript.sessionID === sessionId);

    if (!matchingTranscript) {
      // Return user-friendly HTML if no transcript is found and html=true
      if (html === 'true') {
        const notFoundHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; text-align: center;">
          <h2 style="margin-bottom: 20px; color: #444;">Conversation Not Found</h2>
          <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
            We couldn't find a conversation with the provided session ID. The conversation may have been deleted or the session ID might be incorrect.
          </p>
          <p style="font-size: 14px; color: #888;">
            Session ID: ${sessionId}<br>
            Project ID: ${projectId}
          </p>
        </div>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        return res.send(notFoundHtml);
      }
      
      // Otherwise return JSON error
      return res.status(404).json({ 
        error: 'No transcript found with the provided session ID',
        availableSessions: transcripts.map(t => t.sessionID)
      });
    }

    // Special case: modify project ID in URL if it matches the specific ID
    let urlProjectId = projectId;
    if (projectId === '678e0f128a8526a7fdf491cd') {
      urlProjectId = '678e0f128a8526a7fdf491ce';
    }

    // Format the URL for the transcript
    const transcriptUrl = `https://creator.voiceflow.com/project/${urlProjectId}/transcripts/${matchingTranscript._id}`;

    // If HTML format is requested, fetch transcript details and format as HTML
    if (html === 'true') {
      try {
        // Fetch the transcript details
        const transcriptDetailsResponse = await axios.get(
          `https://api.voiceflow.com/v2/transcripts/${projectId}/${matchingTranscript._id}`,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': apiKey
            }
          }
        );
        
        const transcriptDetails = transcriptDetailsResponse.data;
        
        // Extract user messages and assistant responses
        const messages = [];
        
        transcriptDetails.forEach(item => {
          // Extract assistant messages (text type)
          if (item.type === 'text' && item.payload?.payload?.message) {
            messages.push({
              type: 'assistant',
              text: item.payload.payload.message,
              time: new Date(item.startTime).toLocaleString()
            });
          } 
          // Extract user input messages (request type with intent payload)
          else if (item.type === 'request' && item.payload?.type === 'intent' && item.payload?.payload?.query) {
            messages.push({
              type: 'user',
              text: item.payload.payload.query,
              time: new Date(item.startTime).toLocaleString()
            });
          }
          // Extract user input messages (user-input type)
          else if (item.type === 'user-input' && item.payload?.payload?.message) {
            messages.push({
              type: 'user',
              text: item.payload.payload.message,
              time: new Date(item.startTime).toLocaleString()
            });
          }
        });
        
        // Sort messages by time
        messages.sort((a, b) => new Date(a.time) - new Date(b.time));
        
        // Generate HTML
        let htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
          <h2 style="text-align: center; margin-bottom: 20px;">Conversation Transcript</h2>
          <div style="margin-bottom: 30px;">
        `;
        
        // Add messages to HTML
        messages.forEach(message => {
          const alignment = message.type === 'user' ? 'right' : 'left';
          const bgColor = message.type === 'user' ? '#E1F5FE' : '#F5F5F5';
          const textAlign = message.type === 'user' ? 'right' : 'left';
          
          htmlContent += `
            <div style="margin-bottom: 15px; text-align: ${alignment};">
              <div style="display: inline-block; max-width: 70%; background: ${bgColor}; padding: 10px 15px; border-radius: 10px; text-align: ${textAlign};">
                <p style="margin: 0; font-size: 16px;">${message.text}</p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #888;">${message.time}</p>
              </div>
            </div>
          `;
        });
        
        // Add View Transcript button
        htmlContent += `
          </div>
          <div style="font-family: Arial, sans-serif; text-align: center; margin: 2em;">
            <p style="font-size: 1.1em;">You can view the full conversation here:</p>
            <a href="${transcriptUrl}" target="_blank" style="
              display: inline-block;
              padding: 0.75em 1.5em;
              font-size: 1em;
              color: #fff;
              background-color: #007BFF;
              border: none;
              border-radius: 0.3em;
              text-decoration: none;
              transition: background-color 0.3s ease;
            " onmouseover="this.style.backgroundColor='#0056b3'" onmouseout="this.style.backgroundColor='#007BFF'">
              View Transcript
            </a>
          </div>
        </div>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        return res.send(htmlContent);
      } catch (error) {
        console.error('Error fetching transcript details:', error.message);
        
        // If we fail to get the details, still return basic HTML with the URL
        const basicHtml = `
        <div style="font-family: Arial, sans-serif; text-align: center; margin: 2em;">
          <p style="font-size: 1.1em;">You can view the conversation here:</p>
          <a href="${transcriptUrl}" target="_blank" style="
            display: inline-block;
            padding: 0.75em 1.5em;
            font-size: 1em;
            color: #fff;
            background-color: #007BFF;
            border: none;
            border-radius: 0.3em;
            text-decoration: none;
            transition: background-color 0.3s ease;
          " onmouseover="this.style.backgroundColor='#0056b3'" onmouseout="this.style.backgroundColor='#007BFF'">
            View Transcript
          </a>
        </div>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        return res.send(basicHtml);
      }
    }
    
    // Check if string parameter is true, return plain text URL
    if (string === 'true') {
      res.setHeader('Content-Type', 'text/plain');
      return res.send(transcriptUrl);
    }

    res.json({
      transcriptUrl,
      transcriptData: matchingTranscript
    });
  } catch (error) {
    console.error('Error getting transcript URL:', error.message);
    res.status(500).json({ 
      error: 'Failed to get transcript URL',
      details: error.response?.data || error.message
    });
  }
});

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 