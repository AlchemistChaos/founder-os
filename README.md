# 🧠 Founder OS

A daily review tool + knowledge assistant designed specifically for founders and entrepreneurs. Founder OS helps you capture, organize, and learn from your daily business activities through intelligent summarization, spaced repetition flashcards, and AI-powered insights.

## ✨ Features

### 🌅 Morning Review
- **Flashcards Due Today**: Spaced repetition system using SM-2 algorithm
- **Yesterday's Business Updates**: Digest from Slack, Linear, Google Docs
- **Meeting Summaries**: Key insights and action items from recent meetings
- **Goal Tracking**: Progress visualization and quick check-ins

### 🌙 Nightly Review
- **Daily Activity Summary**: Consolidated view of all business activities
- **Reflection Prompts**: Customizable questions for self-reflection
- **Starred Items**: Review and bookmark important content
- **Top 10 Selection**: Curate the most important items from your day

### 🧠 Flashcard System
- **Smart Scheduling**: SM-2 spaced repetition algorithm for optimal retention
- **Topic Filtering**: Organize cards by tags and topics
- **Review Sessions**: Focused learning with difficulty-based scheduling
- **Progress Tracking**: Monitor your learning velocity and retention

### 📎 Clips & Bookmarks
- **Multi-Source Capture**: Articles, videos, tweets, documents, personal notes
- **Auto-Tagging**: AI-powered categorization and metadata extraction
- **Smart Filtering**: Search by type, source, date, and tags
- **Flashcard Conversion**: Turn any content into learning material

### 🔍 Search & Ask
- **Semantic Search**: Find content across your entire knowledge base
- **AI Assistant**: Ask questions about your data and get intelligent answers
- **Context-Aware**: Responses based on your specific business context
- **Conversation History**: Track your insights and learning over time

### 🔌 Chrome Extension
- **One-Click Clipping**: Save any web content directly to your knowledge base
- **Text Selection**: Capture specific quotes and excerpts
- **Auto-Metadata**: Automatic title, URL, and source detection
- **Instant Flashcards**: Convert clips to learning material on the spot

## 🏗️ Tech Stack

- **Frontend**: Next.js 15 + React 19 + Tailwind CSS
- **Backend**: Next.js API Routes + Supabase
- **Database**: PostgreSQL (Supabase)
- **AI**: OpenAI GPT-4 (summarization, Q&A, tagging)
- **Extension**: Chrome Extension Manifest V3
- **Authentication**: Supabase Auth
- **Deployment**: Vercel (recommended)

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/founder-os.git
   cd founder-os
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Add your keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   OPENAI_API_KEY=your_openai_api_key
   ```

4. **Set up Supabase database**
   - Create a new Supabase project
   - Run the SQL commands in `supabase-schema.sql`

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Install Chrome Extension** (optional)
   - Open Chrome Extensions page (`chrome://extensions/`)
   - Enable Developer mode
   - Click "Load unpacked" and select the `chrome-extension` folder

## 📊 Database Schema

### Entries Table
- **id**: UUID primary key
- **type**: Entry type (slack, linear, doc, meeting, clip, reflection)
- **content**: Full text content
- **metadata**: JSON metadata (source details, etc.)
- **tags**: Array of tags for categorization
- **is_flashcard**: Boolean flag for flashcard conversion
- **source_url**: Original URL (if applicable)
- **timestamps**: Created/updated timestamps

### Flashcards Table
- **id**: UUID primary key
- **entry_id**: Foreign key to entries table
- **question**: Flashcard question
- **answer**: Flashcard answer
- **due_at**: Next review date
- **ease_factor**: SM-2 ease factor (1.3-2.5)
- **interval**: Days until next review
- **repetition_count**: Number of successful reviews

### Goals Table
- **id**: UUID primary key
- **title**: Goal title
- **description**: Detailed description
- **tags**: Array of related tags

## 🔧 Configuration

### Environment Variables
| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI features | Yes |

### Chrome Extension Setup
1. Configure your Founder OS URL in the extension popup
2. Optionally set an API key for authenticated requests
3. Grant necessary permissions for content capture

## 🔗 API Endpoints

### Core Endpoints
- `POST /api/entries` - Create new entries
- `GET /api/entries` - Fetch entries with filtering
- `POST /api/summarize` - Generate AI summaries
- `POST /api/generate-flashcard` - Create flashcards from content
- `POST /api/ask` - Ask questions about your data

### Integration Endpoints
- `POST /api/integrations/slack` - Slack webhook handler
- `POST /api/integrations/linear` - Linear webhook handler
- `POST /api/integrations/docs` - Google Docs changes

## 🎯 Usage Patterns

### Daily Workflow
1. **Morning**: Review flashcards due + check updates
2. **Throughout Day**: Clip important content via extension
3. **Evening**: Complete nightly reflection + curate top items
4. **Weekly**: Review goals and generate insights

### Content Organization
- **Tag Everything**: Use consistent tagging for easy retrieval
- **Convert Key Insights**: Turn important content into flashcards
- **Regular Review**: Use the spaced repetition system consistently
- **Ask Questions**: Leverage AI to find patterns in your data

## 🚧 Future Enhancements

- **Mobile App**: React Native app for on-the-go access
- **Voice Integration**: Voice memos and transcription
- **Calendar Integration**: Automatic meeting capture
- **Slack Bot**: Direct integration with Slack workspace
- **Export Options**: PDF reports and data export
- **Team Features**: Shared knowledge bases and insights

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/founder-os/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/founder-os/discussions)
- **Email**: support@founder-os.com

---

Built with ❤️ for the founder community. Turn your daily grind into lasting knowledge.