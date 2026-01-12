 # Franzke Technologies Website

## Project Overview

This is the website for Franzke Technologies, a consulting and development firm run by Timothy Franzke. The site serves as both a consultancy presence and portfolio showcase.

## About Timothy Franzke

- 20+ years of professional software architecture experience
- Currently employed as Solutions Architect over AI Solutions (transitioning to full-time consulting)
- Specializes in AI-augmented development—using AI tools to accelerate delivery while maintaining architectural rigor
- Based in Kansas City area

## Brand Positioning

**Core message:** "20 years of architecture experience, accelerated by AI."

Timothy is not an AI hype person. He's a seasoned architect who uses AI as a tool to ship faster and solve problems more efficiently. The tone should be:

- Practical, not buzzwordy
- Confident but not boastful
- Approachable and human
- Focused on helping others, not self-promotion

**Voice guidelines:**
- Write like a smart colleague explaining something, not a marketer selling something
- Avoid jargon unless explaining it
- Use "I" not "we" (this is a solo consultancy)
- Keep copy concise—no fluff

## Services

### 1. AI Strategy & Implementation
Helping teams figure out where AI fits in their workflow and actually ship it. Not theoretical—practical implementation.

### 2. Delivery Acceleration
Fractional architect work. Helping teams build and deliver faster through better architecture decisions, process improvements, and AI-augmented workflows.

### 3. Workshops & Training
Teaching teams how to integrate AI into their development workflow. Focus on practical, hands-on learning.

### 4. Web & Software Development
Full-stack development for web applications, ecommerce platforms, and custom software. Modern stacks, fast delivery.

## Portfolio / Past Work

### Enterprise & Government
- **NBA TopShots** — Consulted on Kafka cluster optimization to scale their NFT platform
- **NGA (National Geospatial-Intelligence Agency)** — Built internal Node.js dashboards
- **MyRetailBuddy** — Designed and built distributed IoT architecture for gas meter reading systems using AWS IoT Core

### SaaS & Platforms
- **Kindercosmos** — Built and operated a daycare management platform (2019-2023)

### Web & Ecommerce
- **hoorfarlaw.com** — Law firm website
- **kc360gym.com** — Gymnastics facility website (Timothy owns this business)
- **pathwaymicroschool.com** — Microschool website
- **just4215.com** — Ecommerce platform for Just4215 basketball program
- **EEclipse** — Ecommerce platform for basketball program

## Tech Stack (Site)

- **Framework:** Astro
- **Styling:** Tailwind CSS
- **Blog:** Markdown/MDX files
- **Deployment:** [TBD - Netlify/Vercel/Cloudflare]
- **Contact form:** [TBD]

## Site Structure

```
/                     # Homepage - value prop, services overview, recent posts
/about                # Timothy's background, philosophy, 20 years context
/services             # Detailed service offerings
/work                 # Portfolio/case studies
/blog                 # Blog listing
/blog/[slug]          # Individual blog posts
/contact              # Contact form or booking link
```

## Blog Content Strategy

The blog serves two purposes:
1. **Visibility** — Stay top of mind with network, attract inbound leads
2. **Demonstration** — Show expertise through practical, helpful content

**Content themes:**
- Demystifying AI concepts (agents, MCP, RAG, context windows)
- Lessons from 20 years of architecture
- Practical delivery/shipping advice
- AI-augmented development workflows
- Occasional project retrospectives (non-confidential)

**Tone:** Helpful, practical, humble. Teaching what he knows, not performing expertise.

## Design Direction

- Clean, minimal, professional
- Not overly corporate—should feel like a person, not an agency
- Fast-loading, accessible
- Mobile-friendly
- Light mode default, dark mode optional

## Development Notes

- Prioritize performance and SEO
- Use semantic HTML
- Ensure accessibility (WCAG 2.1 AA)
- Blog posts should support code syntax highlighting
- Consider RSS feed for blog

## Contact / CTA Strategy

Primary CTA: "Let's talk" or "Get in touch"
- Link to Calendly or similar for booking calls
- Simple contact form as fallback
- LinkedIn profile link

Avoid aggressive sales language. The pitch is: "Here's what I do. If that's useful to you, let's talk."

## Files and Structure Reference

```
/
├── src/
│   ├── pages/
│   │   ├── index.astro
│   │   ├── about.astro
│   │   ├── services.astro
│   │   ├── work.astro
│   │   ├── contact.astro
│   │   └── blog/
│   │       ├── index.astro
│   │       └── [...slug].astro
│   ├── content/
│   │   └── blog/
│   │       └── *.md
│   ├── components/
│   ├── layouts/
│   └── styles/
├── public/
├── astro.config.mjs
├── tailwind.config.cjs
└── package.json
```

## Key Phrases / Copy Snippets

**Tagline options:**
- "20 years of architecture. Accelerated by AI."
- "Ship faster. Build smarter."
- "AI-augmented development for teams that need to move."

**Value prop (homepage):**
I've spent 20 years helping teams architect and deliver software. Now I use AI to do it faster. Whether you need strategic guidance, hands-on development, or help getting your team up to speed—I can help.

**About snippet:**
I'm a software architect with 20+ years of experience across enterprise systems, startups, and everything in between. I've built IoT platforms, optimized Kafka clusters for NFT marketplaces, shipped ecommerce sites, and run my own SaaS. These days, I focus on AI-augmented development—using AI tools to accelerate what I've always done: help teams build and deliver fast.