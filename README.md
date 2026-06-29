# Lexa

A mobile-first web app for learning words that stick. Capture vocabulary you do
not understand yet, then lock it into memory with **spaced repetition** (FSRS)
and **active recall**. The goal is not just recognising a word but knowing how to
use it.

## Highlights

- **Local-first.** Everything lives in your browser via IndexedDB. No account, no
  server, works fully offline.
- **Installable PWA.** Add it to your phone's home screen and review like a native
  app.
- **FSRS scheduling.** Uses the modern, research-backed FSRS algorithm
  (`ts-fsrs`) to schedule each card right before you would forget it.
- **Four card types per word**, each scheduled independently:
  - **Meaning** - word to definition
  - **Reverse** - definition to word
  - **Typed recall** - type the word (auto-graded, tolerant of typos and accents)
  - **In a sentence** - fill in the blank from your example sentences
- **AI enrichment (optional).** Paste a DeepSeek API key in Settings and Lexa
  drafts definitions, example sentences, and synonyms from just a word.
- **Backup.** Export and import your whole collection as JSON.

## Tech stack

React + Vite + TypeScript, Tailwind CSS v4, Dexie (IndexedDB), `ts-fsrs`,
`vite-plugin-pwa`, Outfit (variable font).

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

Build and preview the production PWA:

```bash
npm run build
npm run preview
```

## AI enrichment setup

1. Get a DeepSeek API key from the DeepSeek console.
2. Open **Settings** in the app and paste it in. It is stored only in your
   browser and sent directly to DeepSeek.
3. On the **Add** screen, type a word and tap **Generate with AI**.

Note: because this is a local-first app, the key is used client-side. That is
fine for personal use. If you ever host Lexa publicly for others, route the
DeepSeek call through a small server-side proxy so the key is never exposed.

## Project structure

```
src/
  ai/deepseek.ts     DeepSeek enrichment client (OpenAI-compatible)
  db/                Dexie schema, types, repository (CRUD, queue, stats, backup)
  srs/               FSRS wrapper, card generation, typed-answer grading
  components/        Layout (bottom tab bar), UI primitives, icons
  pages/             Home, Add, Review, Words, Settings
  lib/theme.ts       Light/dark/system theme handling
```

Data is local to the device. Use **Settings → Backup → Export** to keep a copy.
