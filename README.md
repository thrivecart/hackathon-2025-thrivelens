# ThriveLens

An AI-powered UX audit and conversion optimization assistant built with Nuxt 3. Thrivelens analyzes website screenshots using GPT-4V to provide actionable conversion rate optimization recommendations.

## What is ThriveLens?

ThriveLens combines OpenAI's vision and reasoning capabilities with automated screenshot capture to deliver expert-level UX audits through a conversational interface. Simply provide a URL, and get detailed analysis scored across six key categories:

- **Visual Design**: Layout consistency, spacing, contrast, visual hierarchy, readability
- **Content & Messaging**: Headline clarity, value proposition, CTA language, trust signals
- **Conversion Readiness**: CTA prominence, form usability, pricing clarity, urgency elements
- **Mobile Optimization**: Responsive design, tap targets, mobile-friendly layouts
- **Trust & Credibility**: Social proof, payment security, policy visibility, testimonials
- **Accessibility**: WCAG compliance, keyboard navigation, screen reader support (lower priority for checkout pages)


## Quick Start

### Prerequisites

- Node.js 18+ 
- OpenAI API key with GPT-4V access
- ThriveCart API key (optional, for product integration)

### Setup

1. **Install dependencies:**

```bash
npm install
```

2. **Configure environment variables:**

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```bash
NUXT_OPENAI_API_KEY=your_openai_api_key_here
NUXT_THRIVECART_API_KEY=your_thrivecart_api_key_here  # Optional
```

3. **Start the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### UX Audit Examples

**Website Analysis:**
- `audit https://example.com/checkout`
- `analyze landing page https://example.com`
- `review product page https://shop.com/product`
- `check mobile UX https://site.com`

**ThriveCart Integration:**
- `show me my top 10 products`
- `what are my products with their URLs?`
- `audit the checkout page for my top product`
- `compare the UX of my two best-selling products`
- `which checkout drives more sales between Product A and Product B?`
- `analyze the mobile experience of my product checkout`

**Complete Workflow Example:**
```
You: "What are my top 2 most refunded products?"
AI: [Analyzes refund transactions, returns Product A and Product B]

You: "Audit these 2 sites for UX analysis"
AI: [Captures screenshots and analyzes both product checkout pages]

You: "Why is Product A refunded more than Product B?"
AI: [Compares UX audits and identifies friction points causing refunds]
```

**Follow-up Questions:**
- `what were the recommendations?`
- `what was the score?`
- `do you see an affiliate link in the menu?`
- `what color is the CTA button?`

**PDF Export:**
- `export the audit as PDF`
- `generate a PDF report for each product`

**Image Analysis:**
- Upload a screenshot and ask `analyze this checkout page`
## ThriveCart Workflow Examples

ThriveLens combines ThriveCart business data with automated UX analysis to help you understand **why** products perform differently.

### Example 1: Identify Refund Issues

```
1. "What are my top 2 most refunded products?"
   → AI fetches refund transactions, identifies Product A (50 refunds) and Product B (15 refunds)

2. "Audit these 2 sites for UX analysis"
   → AI captures screenshots and analyzes both checkout pages

3. "Why is Product A refunded more than Product B?"
   → AI compares UX audits and identifies:
     • Product A has confusing pricing display (high priority issue)
     • Product A lacks clear refund policy (trust issue)
     • Product B has stronger trust signals
     • Product A's mobile checkout has usability issues
```

### Example 2: Optimize Best Sellers

```
1. "Show me my top 3 products by sales"
   → AI analyzes charge transactions

2. "Audit the checkout pages for all 3"
   → AI performs UX analysis on each product

3. "Which one has the best mobile experience?"
   → AI compares mobile scores and recommends improvements

4. "Export PDF reports for each product"
   → AI generates individual professional reports
```

### Example 3: Reduce Cancellations

```
1. "Which products have the most subscription cancellations?"
   → AI filters by transactionType="cancel"

2. "Audit the checkout page for the most cancelled product"
   → AI analyzes UX issues that may cause cancellations

3. "What are the top 3 improvements to reduce cancellations?"
   → AI provides prioritized recommendations based on UX analysis
```

## Features

### UX Audit Capabilities
- **Automated Screenshot Capture**: Desktop, mobile, tablet viewports with Playwright
- **Dual-Pass GPT-4V Analysis**: Initial vision analysis + refinement for accuracy
- **Page-Type Specific Feedback**: Tailored recommendations for checkout, landing, product, homepage, signup pages
- **Visual Question Answering**: Ask specific questions about page elements using GPT-4V
- **Professional PDF Reports**: Export individual site audits with scores, recommendations, and insights

### Smart Session Management
- **Persistent Conversations**: Server-side JSONL-based session storage
- **Screenshot Reuse**: AI automatically references existing screenshots from session history
- **Asset Persistence**: All screenshots and analyses saved with conversation context
- **Follow-up Queries**: Ask questions about previous audits without re-capturing

### PDF Export
- **Individual Site Reports**: Export detailed UX audits as professional PDFs
- **Multi-Device Analysis**: Combined desktop/mobile/tablet insights in single report
- **Automatic Data Extraction**: AI retrieves audit data from session history
- **Priority-Based Recommendations**: High/medium/low priority scoring with expected impact

### ThriveCart Integration
- **Product Management**: List products, get details, view pricing options
- **Transaction Analysis**: Review charges, rebills, refunds, and cancellations
- **Funnel Insights**: View upsells, downsells, and product flow
- **Automated UX Audits**: AI can fetch product URLs and audit them automatically
- **Cross-Product Comparison**: Compare UX and conversion potential across multiple products

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
│       │   ├── ux-audit-tools.ts         # UX audit + screenshot capture
│       │   ├── visual-qa-tools.ts        # Visual Q&A with GPT-4V
│       │   ├── pdf-export-tools.ts       # PDF report generation
│       │   ├── session-retrieval-tools.ts # Audit data retrieval
│       │   ├── tools-registry.ts         # MCP tools router
│       │   └── reasoning-loop.ts         # Tool execution logic
│       ├── pdf/
│       │   └── audit-report-generator.ts # PDF rendering with jsPDF
│       ├── prompts/
│       │   └── thrivelens-prompts.ts     # System prompts
│       └── session-manager.ts            # JSONL session storage
└── assets/
    └── styles.css              # Design system
```

## Technologies

- **Framework**: [Nuxt 3](https://nuxt.com/)
- **AI**: OpenAI GPT-4V
- **Browser Automation**: Playwright
- **Protocol**: Model Context Protocol (MCP)
- **Styling**: Tailwind CSS
