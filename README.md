# VibeAsk – AI-Powered Personalized Learning Ecosystem

## Overview

**VibeAsk** is an intelligent learning platform designed to transform how JEE and NEET aspirants approach exam preparation. It bridges the critical gap between theoretical understanding and problem-solving ability by providing an all-in-one ecosystem that combines interactive doubt-solving, personalized learning paths, and AI-powered expert guidance.

### Team

- **Team Name**: Dhurandhar
- **Team Members**: Shrivardhan Patil, Parth Patil, Sudarshan Patil, Pruthviraj Pawar

---

## The Problem

### Critical Statistics

- **70%** of aspirants rely on YouTube for learning
- Students watch **3–4 videos** just to solve a single question
- Over **80%** understand theory but fail in problem-solving
- **Tier 2/3 cities** lack access to on-demand expert guidance
- Learning is **fragmented** across multiple platforms

### Core Learning Challenges

#### The Passive Learning Trap

- Students hunt for the "perfect explanation video" instead of solving problems
- Visual understanding ≠ exam-ready problem solving
- When stuck mid-question, there's no intelligent way to ask "WHY THIS step?"
- Active recall tools exist — but outside the actual learning flow

#### The Credibility & Accuracy Gap

- AI tools often hallucinate theory or oversimplify formulas
- Students hesitate to trust answers without textbook reference
- NCERT line-by-line accuracy matters — especially for NEET
- One wrong assumption = negative marking in exams

#### No Personalization, No Memory

- Tools don't remember:
  - What chapter you're on
  - Where you usually get stuck
  - Whether you're visual or step-driven
  - Every doubt feels like starting from zero again

#### The Fragmentation Problem

- Lectures on one app
- Doubts on another
- Notes somewhere else
- Test analysis nowhere
- Learning is scattered, not structured

---

## The Solution: VibeAsk

### Core Value Proposition

**From Struggle to Mastery:**

1. Replace endless video searching with **instant, interactive doubt-solving**
2. Transform JEE/NEET aspirants from passive learners to **confident problem-solvers**
3. Bridge the critical "I understand theory but can't solve problems" gap through **AI-powered step-by-step guidance**

### Our Integrated Learning Ecosystem

- **All-in-one platform** connecting handwritten questions, subject-expert AI agents, visual animations, and verified textbook references
- **AI-powered personalization** that remembers each student's learning journey and adapts explanations to their level
- **Smart question bank** that suggests targeted JEE/NEET practice problems
- **Interactive solutions** rendered step-wise, allowing students to pause and clarify doubts anytime

---

## Key Features

### Core Features

#### 1. **OCR to Markdown for Consistent LaTeX Input**

- Converts handwritten photos, typed LaTeX, or plain text into consistent markdown format
- Eliminates hallucination from bad formatting
- Ensures model consistency irrespective of input method

#### 2. **Step-wise Solution Rendering**

- Users can ask questions on each step of the solution
- Interactive, pausable explanations
- Deep drill-down capability for any concept

#### 3. **Different AI Agents for Different Subjects**

- Dedicated Mistral agents for Physics, Chemistry, Maths, and Biology
- Subject-specific expertise and accuracy
- Coherent problem-solving approach within each domain

### Premium Features

#### 1. **Video Explanations**

- Visual rendering of problems and solutions
- Helps students understand complex concepts through animation
- 30–40 second animated explanations (Manim-Py)

#### 2. **Smart Textbook Assistant**

- Provides exact textbook content + images
- Verified NCERT references
- Builds trust in AI-generated answers
- Line-by-line accuracy for NEET/JEE alignment

#### 3. **Personalization: AI Remembers Your Learning Style**

- Adapts answers based on preferred learning style
- Tracks understanding level (Beginner / Developing / Advanced)
- Evolves recommendations based on interaction patterns

#### 4. **Smart Question Suggestions**

- Suggests targeted questions from JEE/NEET database
- Question selection based on weak areas
- Difficulty scaling based on performance

#### 5. **Voice Mode**

- Step-by-step auditory explanations
- Hands-free learning experience
- Accessible for on-the-go learning

---

## Personalized Learning Roadmap

### How VibeAsk Adapts to You

The platform creates customized learning paths through:

1. **Student Level Detection**
   - Based on diagnostic quiz & first interactions
   - Levels: Beginner / Developing / Advanced

2. **Goal-Based Sequencing**
   - Roadmap based on exam target (JEE Mains / Advanced / NEET)
   - Custom topic ordering aligned with your goals

3. **Measurable Progress Metrics**
   - Tracks concepts mastered
   - Identifies error patterns
   - Highlights weak topics

4. **Weekly Auto-Update**
   - Roadmap dynamically updates based on quiz performance
   - Adapts to doubt patterns and learning velocity

### Learning Components

The personalization dashboard includes:

- **Diagnostic Assessment** - Initial skill evaluation
- **Weak Area Detection** - Identifies knowledge gaps
- **Custom Topic Sequence** - Tailored learning order
- **Daily Practice Questions** - Spaced repetition based on performance
- **RoadMap Division** - Clear milestones and checkpoints
- **Questions Check** - Performance validation and refinement

---

## Implementation Overview

### Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Student Input  │────▶│ OCR Engine       │────▶│  Mistral AI    │
│  (Photo/Text)   │     │ (Mistral Vision) │     │  Agents        │
└─────────────────┘     └──────────────────┘     └────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ Subject Detection │
                        └──────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
            ┌─────────────┬──────────────┬──────────┐
            │  Physics    │  Chemistry   │  Maths   │
            │  Agent      │  Agent       │  Agent   │
            └─────────────┴──────────────┴──────────┘
                    │            │            │
                    └────────────┼────────────┘
                                 ▼
                    ┌──────────────────────┐
                    │ Step Renderer        │
                    │ (Manim-Py)          │
                    │ Supermemory (Convex)│
                    └──────────────────────┘
                                 │
                    ┌────────────┬────────────┐
                    ▼            ▼            ▼
            ┌─────────────┬──────────────┬──────────┐
            │  Solution   │  Video       │  Smart   │
            │  Output     │  Animation   │  Textbook│
            └─────────────┴──────────────┴──────────┘
```

### Tech Stack

#### AI & Frameworks

- **Mistral AI** - Core LLM backbone for subject-specific agents ("Aryabhatta" mode)
- **ColPali** - Vector search for textbook image/text retrieval
- **Vercel AI SDK v5** - Tool orchestration and streaming
- **LangChain** - Agent framework (when applicable)

#### Animations & Video Libraries

- **Manim-Py** - Mathematical animation engine for 30–40 sec explanations
- **Three.js / Babylon.js** - Interactive 3D visualizations (optional)

#### Database & Memory

- **Supabase + pgVector** - Vector embeddings for semantic search
- **Supermemory (Convex)** - Long-term learning pattern storage
- **PostgreSQL** - Conversation history and user profiles

#### Frontend Stack

- **React + TypeScript** - Client-side UI (Vite bundler)
- **shadcn/ui** - Component library
- **TailwindCSS** - Styling

#### Backend & Deployment

- **Express.js** - REST API server
- **Heroku / Vercel** - Deployment platform
- **LiveKit** - Voice integration (optional)

---

## Use Cases

### Primary Users: JEE & NEET Aspirants

**Typical Workflow:**

1. Student captures handwritten/typed question via camera or text input
2. OCR engine converts to consistent markdown format
3. Platform detects subject (Physics, Chemistry, Maths, Biology)
4. Relevant AI agent analyzes question and generates step-by-step solution
5. Student can:
   - Pause at any step and ask clarifying questions
   - Request visual animations
   - Access related textbook content
   - See similar practice problems
   - Track learning progress in personalized dashboard

### Impact & Outcomes

- **Reduced time-to-solution**: From 15 min (video hunting) → <2 min (VibeAsk)
- **Improved problem-solving**: Theory + active practice in unified flow
- **Accessible expert guidance**: Available to Tier 2/3 city students
- **Personalized pathways**: Custom curriculum based on strength/weakness
- **Trust + accuracy**: NCERT-aligned, citation-backed answers

---

## Business Model

### Revenue Streams

1. **Freemium Model**
   - Basic: Text-based doubt solving (free)
   - Premium: Video explanations, smart textbook access, voice mode, personalization ($5–10/month)

2. **Institutional Partnerships**
   - Coaching centers & schools licensing for JEE/NEET prep
   - B2B subscriptions ($100–500/month per institution)

3. **Analytics & Reporting**
   - Schools/mentors access to learning dashboards
   - Student performance insights

---

## Getting Started

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-org/vibeask.git
   cd vibeask
   ```

2. **Install dependencies:**

   ```bash
   # AI Service
   cd services/ai-service
   npm install

   # Widget (Frontend)
   cd services/widget
   npm install

   # Admin Dashboard
   cd services/admin-dashboard
   npm install
   ```

3. **Set up environment variables:**

   ```bash
   # services/ai-service/.env
   OPENAI_API_KEY=your_key
   MISTRAL_API_KEY=your_key
   SUPABASE_URL=your_url
   SUPABASE_SERVICE_KEY=your_key
   LIVEKIT_URL=your_url
   LIVEKIT_API_KEY=your_key
   LIVEKIT_API_SECRET=your_secret

   # services/widget/.env
   VITE_COLLEGE_ID=demo-college
   VITE_API_BASE_URL=http://localhost:3000
   ```

4. **Run the development servers:**

   ```bash
   # AI Service (Terminal 1)
   cd services/ai-service && npm run dev

   # Widget (Terminal 2)
   cd services/widget && npm run dev

   # Admin Dashboard (Terminal 3)
   cd services/admin-dashboard && npm run dev
   ```

### Database Setup

1. Create Supabase project
2. Run migrations from `services/admin-dashboard/supabase/schema.sql`
3. Seed sample data (optional)

---

## Project Structure

```
vibeask/
├── services/
│   ├── ai-service/          # Express.js backend with Mistral agents
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── ai/      # AI agents & tools
│   │   │   │   └── rag/     # Vector search & retrieval
│   │   │   └── routes/
│   │   └── package.json
│   │
│   ├── widget/              # React widget (Vite) for embedding
│   │   ├── src/
│   │   │   ├── components/
│   │   │   └── lib/
│   │   └── package.json
│   │
│   ├── admin-dashboard/     # Next.js admin panel
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── actions/ # Server actions
│   │   │   │   └── dashboard/
│   │   │   └── lib/
│   │   ├── supabase/
│   │   │   └── schema.sql
│   │   └── package.json
│   │
│   └── voice-agent/         # Python LiveKit agent (optional)
│       ├── src/
│       │   └── agent.py
│       └── requirements.txt
│
└── README.md
```

---

## Development Workflow

### Key Commands

```bash
# AI Service
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run test         # Run tests (if available)

# Widget
npm run dev          # Start Vite dev server
npm run build        # Production bundle for CDN
npm run preview      # Preview build locally

# Admin Dashboard
npm run dev          # Start Next.js dev server
npm run deploy       # Deploy to production
```

### Code Conventions

- **ESM modules** everywhere (`"type": "module"` in package.json)
- **TypeScript** for all new code
- **Zod** for schema validation
- **shadcn/ui** for UI components
- **AES-GCM** encryption for messages at rest

---

## Performance Considerations

- **Vector embedding caching** to reduce inference costs
- **Step-function splitting** to minimize token usage
- **CDN delivery** for widget (Vercel)
- **Database indexing** on frequently-searched fields

---

## Future Roadmap

- [ ] Mobile apps (iOS/Android)
- [ ] Extended subject support (Biology, English)
- [ ] Collaborative study groups
- [ ] AI-powered test analysis & recommendations
- [ ] Marketplace for community-created resources
- [ ] Integration with coaching centers' learning management systems

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

This project is licensed under the **MIT License** — see `LICENSE` for details.

---

## Support & Contact

For questions, bug reports, or feature requests:

- **Email**: support@vibeask.com
- **Discord**: [Join our community](https://discord.gg/vibeask)
- **Documentation**: [Full docs](https://docs.vibeask.com)

---

## Acknowledgments

- Mistral AI for the powerful language models
- Supabase for database infrastructure
- Vercel for seamless deployment
- The JEE/NEET community for inspiration and feedback

---

**Made with ❤️ by the Dhurandhar Team**
 

_Transforming learning from fragmented to personalized, from passive to active._
