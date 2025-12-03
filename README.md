# Faucet Finder Chat

A Next.js application that uses Google's Gemini AI to identify faucets from uploaded images.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env.local` file with your Google API key:

```bash
GOOGLE_API_KEY=your_gemini_api_key_here
```

Get your API key from: https://aistudio.google.com/app/apikey

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- **Image Upload**: Drag and drop or browse to upload faucet images (PNG, JPG, JPEG)
- **AI-Powered Matching**: Uses Gemini 2.0 Flash Lite to analyze faucet images
- **Chat Interface**: Conversational UI for asking questions about faucets
- **Match Results**: Shows top 3 matches with confidence scores and reasoning

## Tech Stack

- **Next.js 14** - React framework with App Router
- **Tailwind CSS** - Styling
- **Google Generative AI** - Gemini API for image analysis
- **Lucide React** - Icons
