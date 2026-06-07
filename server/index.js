require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATABRICKS_TOKEN = process.env.DATABRICKS_TOKEN;
const ENDPOINT = 'https://dbc-67c4d502-2662.cloud.databricks.com/serving-endpoints/agents_dev_genai-default-aqi-model/invocations';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../docs')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', tokenSet: !!DATABRICKS_TOKEN && DATABRICKS_TOKEN !== 'YOUR_TOKEN_HERE' });
});

// Proxy route — forwards chat queries to Databricks
app.post('/api/chat', async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "query" field.' });
  }

  if (!DATABRICKS_TOKEN || DATABRICKS_TOKEN === 'YOUR_TOKEN_HERE') {
    return res.status(500).json({ error: 'DATABRICKS_TOKEN not set in .env file.' });
  }

  // Correct format: input must be an ARRAY (Databricks agent schema requirement)
  // Correct Responses Agent format
  const payload = {input: [{role: "user", content: query}]};

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DATABRICKS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();

    if (response.ok) {
      let json;
      try { json = JSON.parse(text); } catch(_) { json = { raw: text }; }
      const answer = extractAnswer(json);
      return res.json({ answer, raw: json });
    }

    return res.status(502).json({ error: `Request failed with status ${response.status}: ${text}` });

  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

// ── Extract answer from various Databricks response shapes ──
function extractAnswer(json) {
  if (!json) return null;

  // Responses Agent format (OpenAI Responses API)
  if (json.output && Array.isArray(json.output)) {
    // Find the message output item
    const messageItem = json.output.find(item => item.type === 'message');
    if (messageItem?.content) {
      // Extract text from content array
      if (Array.isArray(messageItem.content)) {
        const textContent = messageItem.content
          .filter(c => c.type === 'output_text' || c.text)
          .map(c => c.text)
          .join('\n');
        if (textContent) return textContent;
      }
      // Or direct content string
      if (typeof messageItem.content === 'string') {
        return messageItem.content;
      }
    }
    
    // Fallback: concatenate all text from all output items
    return json.output
      .flatMap(item => {
        if (item.content && Array.isArray(item.content)) {
          return item.content.filter(c => c.text).map(c => c.text);
        }
        if (typeof item.content === 'string') return [item.content];
        return [];
      })
      .join('\n') || 'No response text found';
  }

  // Chat model response
  if (json.choices?.[0]?.message?.content) return json.choices[0].message.content;
  if (json.choices?.[0]?.text) return json.choices[0].text;

  // Predictions array (MLflow model)
  if (json.predictions !== undefined) {
    const p = json.predictions;
    if (Array.isArray(p)) return p[0];
    return p;
  }

  // Other common fields
  if (json.outputs !== undefined) return json.outputs;
  if (json.result !== undefined) return json.result;
  if (json.answer !== undefined) return json.answer;
  if (json.response !== undefined) return json.response;
  if (json.text !== undefined) return json.text;

  // Tabular data
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json)) return json;

  // Return entire object as fallback
  return JSON.stringify(json, null, 2);
}

app.listen(PORT, () => {
  console.log(`\n🌬️  AQI Oracle running at http://localhost:${PORT}`);
  console.log(`   Token set: ${!!DATABRICKS_TOKEN && DATABRICKS_TOKEN !== 'YOUR_TOKEN_HERE' ? '✅' : '❌ Set DATABRICKS_TOKEN in .env'}\n`);
});
