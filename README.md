# 🌬️ AQI Oracle

A professional AI chatbot UI for your Databricks AQI model.

## Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Add your token to .env
#    Open .env and replace YOUR_TOKEN_HERE with your Databricks token

# 3. Start the server
npm start

# 4. Open in browser
#    http://localhost:3000
```

## Project Structure

```
aqi-oracle/
├── .env                  ← Put your DATABRICKS_TOKEN here
├── package.json
├── server/
│   └── index.js          ← Express proxy server (calls Databricks)
└── public/
    └── index.html        ← Chatbot frontend
```

## How It Works

```
Browser → localhost:3000/api/chat → Databricks endpoint → response → Browser
```

The server acts as a proxy so your token stays server-side and CORS is handled cleanly.

## .env

```
DATABRICKS_TOKEN=your_token_here
PORT=3000
```
