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
    
    // Extract titles from URLs
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const url = chunk?.source?.url || "";
      
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

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 