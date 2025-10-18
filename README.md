# ThriveLens

An AI-powered UX audit and conversion optimization assistant built with Nuxt 3. Thrivelens analyzes website screenshots using GPT-4V to provide actionable conversion rate optimization recommendations.

## What is ThriveLens?

ThriveLens combines OpenAI's vision and reasoning capabilities with automated screenshot capture to deliver expert-level UX audits through a conversational interface. Simply provide a URL, and get detailed analysis on:

- **Conversion Optimization**: CTA placement, form design, trust signals
- **User Experience**: Navigation, layout, visual hierarchy
- **Mobile Responsiveness**: Cross-device experience analysis
- **Accessibility**: WCAG compliance and usability issues
- **SEO & Performance**: Technical optimization recommendations


## Quick Start

### Prerequisites

- Node.js 18+ 
- OpenAI API key with GPT-4V access

### Setup

1. **Install dependencies:**

```bash
npm install
```

2. **Configure environment variables:**

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```bash
NUXT_OPENAI_API_KEY=your_openai_api_key_here
```

3. **Start the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

Try these example queries in the chat interface:

- `audit https://example.com/checkout`
- `analyze landing page https://example.com`
- `review product page https://shop.com/product`
- `check mobile UX https://site.com`
- `audit homepage design https://company.com`

## Features

### UX Audit Tool
- Automated screenshot capture (desktop, mobile, tablet viewports)
- GPT-4V powered visual analysis
- Page-type specific recommendations (checkout, landing, product, homepage)
- Priority scoring for recommendations
- Element-specific, actionable feedback

### Smart Caching
- Screenshot cache (6 hours) to avoid redundant captures
- Analysis cache for faster responses
- Efficient resource usage

### Modern UI
- ChatGPT-inspired minimal design
- Light/dark mode with system preference detection
- Responsive layout
- Quick action buttons for common queries

## Development

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Generate Static Site

```bash
npm run generate
```

## Project Structure

```
thrivelens/
├── app/
│   ├── app.vue                 # Root layout
│   ├── pages/index.vue         # Chat interface
│   └── components/
│       ├── Chat.vue            # Conversational UI
│       └── ThemeToggle.vue     # Theme switcher
├── server/
│   ├── api/
│   │   └── chat-stream.post.ts # Main chat endpoint
│   └── lib/
│       ├── mcp/
│       │   ├── ux-audit-tools.ts    # UX audit implementation
│       │   ├── tools-registry.ts    # MCP tools router
│       │   └── reasoning-loop.ts    # Tool execution logic
│       └── prompts/
│           └── thrivelens-prompts.ts # System prompts
└── assets/
    └── styles.css              # Design system
```

## Technologies

- **Framework**: [Nuxt 3](https://nuxt.com/)
- **AI**: OpenAI GPT-4V
- **Browser Automation**: Playwright
- **Protocol**: Model Context Protocol (MCP)
- **Styling**: Tailwind CSS
