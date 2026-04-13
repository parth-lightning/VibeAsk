# Setup Instructions

Complete setup guide for the Voice Agent service.

## Prerequisites

- Python 3.9 or higher
- `uv` package manager ([install here](https://docs.astral.sh/uv/getting-started/installation/))

## Step 1: Install UV Package Manager

### macOS/Linux

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Windows

```bash
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Verify installation:

```bash
uv --version
```

## Step 2: Get API Keys

### LiveKit Cloud

1. Go to [LiveKit Cloud](https://cloud.livekit.io)
2. Create an account
3. Create a new project
4. Copy your:
   - WebSocket URL (`LIVEKIT_URL`)
   - API Key (`LIVEKIT_API_KEY`)
   - API Secret (`LIVEKIT_API_SECRET`)

### OpenAI

1. Visit [OpenAI API](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key (`OPENAI_API_KEY`)

### Deepgram

1. Go to [Deepgram Console](https://console.deepgram.com)
2. Sign up for an account
3. Create an API key
4. Copy the key (`DEEPGRAM_API_KEY`)

### Cartesia

1. Visit [Cartesia](https://play.cartesia.ai)
2. Create an account
3. Generate an API key
4. Copy the key (`CARTESIA_API_KEY`)

## Step 3: Configure Environment

Create `.env.local` file:

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in all your API keys:

```bash
# LiveKit Configuration
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# OpenAI (LLM)
OPENAI_API_KEY=sk-your-openai-key

# Deepgram (STT)
DEEPGRAM_API_KEY=your_deepgram_key

# Cartesia (TTS)
CARTESIA_API_KEY=your_cartesia_key
```

## Step 4: Install Dependencies

```bash
uv sync
```

This will:

- Create a virtual environment
- Install all required packages
- Lock dependency versions in `uv.lock`

## Step 5: Download Models

Pre-download ML models for faster startup:

```bash
uv run python src/agent.py download-files
```

This downloads:

- Silero VAD model (~50MB)
- Multilingual turn detector model

## Step 6: Test the Agent

### Console Mode (Local Testing)

Test with your microphone locally:

```bash
uv run python src/agent.py console
```

You should see:

```
INFO: Worker connected
INFO: Waiting for jobs...
```

Speak into your microphone and the agent will respond!

### Development Mode (LiveKit Cloud)

Connect to LiveKit Cloud for testing with frontend:

```bash
uv run python src/agent.py dev
```

Then test via:

- LiveKit Playground in dashboard
- Your React widget (Phase 8)

## Verification Checklist

- [ ] UV installed (`uv --version` works)
- [ ] All API keys obtained
- [ ] `.env.local` created and filled
- [ ] Dependencies installed (`uv sync` successful)
- [ ] Models downloaded (`download-files` successful)
- [ ] Console mode works (can hear agent)
- [ ] Dev mode connects to LiveKit Cloud

## Common Issues

### SSL Certificate Error (macOS)

**Error**: `[SSL: CERTIFICATE_VERIFY_FAILED]`

**Solution**:

```bash
/Applications/Python\ 3.13/Install\ Certificates.command
```

### Import Errors

**Error**: `ModuleNotFoundError: No module named 'livekit'`

**Solution**: Make sure you're using UV:

```bash
uv run python src/agent.py console
```

NOT: `python src/agent.py console`

### API Key Errors

**Error**: `Unauthorized` or `Invalid API key`

**Solution**:

- Verify keys are correct in `.env.local`
- Check for extra spaces or quotes
- Ensure `.env.local` is in the `voice-agent/` directory

### Microphone Not Working

**Solution**:

- Grant microphone permissions to Terminal
- Check System Preferences → Security & Privacy → Microphone
- Test microphone with another app first

### Agent Not Responding

**Checklist**:

1. Check all API keys are set
2. Verify internet connection
3. Check logs for errors
4. Try console mode first before dev mode

## Development Workflow

### 1. Local Development

```bash
# Run in console mode for quick testing
uv run python src/agent.py console
```

### 2. Format Code

```bash
uv run ruff format
uv run ruff check
```

### 3. Run Tests (if added)

```bash
uv run pytest
```

### 4. Deploy to Railway

```bash
# Push to GitHub
git add .
git commit -m "Update voice agent"
git push

# Railway auto-deploys
```

## Next Steps

After successful setup:

1. **Test in console mode** - Verify multilingual support
2. **Connect to LiveKit Playground** - Test with UI
3. **Deploy to Railway** - Production deployment
4. **Add RAG tools** - Phase 7 (coming soon)
5. **Integrate with widget** - Phase 8 (coming soon)

## Support

For issues or questions:

- Check [LiveKit Agents Docs](https://docs.livekit.io/agents/)
- Review error logs in terminal
- Verify all prerequisites are met

## Project Structure

```
voice-agent/
├── src/
│   ├── __init__.py
│   └── agent.py          # Main implementation
├── tests/
├── pyproject.toml        # Dependencies
├── .env.example          # Template
├── .env.local           # Your secrets
├── Dockerfile           # Production
└── README.md           # Overview
```

## Features Included

✅ Deepgram Nova-3 STT (multilingual)  
✅ Cartesia Sonic-3 TTS (Indian languages)  
✅ OpenAI GPT-4o-mini LLM  
✅ Silero VAD  
✅ Multilingual turn detection  
✅ Background noise cancellation  
✅ Metrics and logging  
✅ False interruption handling  
✅ Preemptive generation

## What's NOT Included (Yet)

❌ RAG integration (Phase 7)  
❌ Function tools (Phase 7)  
❌ College context (Phase 7)  
❌ Widget integration (Phase 8)

Ready to test! 🚀
