# 📄 EasyRead

**Confusing papers, made clear, in your own language.**

Built for the *Code for Humanity* hackathon.

## The problem

Refugees, rural communities, older adults and people with low literacy often receive official papers they can't fully understand: clinic instructions, medicine labels, school notices, government forms. Misunderstanding them can mean missed appointments, wrong doses, or lost benefits.

## What EasyRead does

Paste text or snap a photo of a document and get:

1. **A short summary in very simple words** (about a 5th-grade reading level)
2. **"What do I need to do?"**: 2-4 action steps, with deadlines highlighted
3. **A translation** into 13 languages (including Khmer, Thai, Vietnamese, Burmese, Arabic, Hindi, Swahili)
4. **Read aloud**, using the browser's built-in speech, for people who can't read well
5. **Warnings** called out clearly (doses, urgent deadlines)
6. **Bigger text** toggle and large, high-contrast buttons for accessibility

EasyRead never invents doses or dates; if something is unclear it says so and points the person to a doctor, pharmacist, teacher or official office.

## Run it

Requires Node 18+ and a free [Gemini API key](https://aistudio.google.com/apikey) (put it in `.env` as `GEMINI_API_KEY`).

```bash
cp .env.example .env     # then put your key in .env
npm start
# open http://localhost:3000
```

No npm packages to install.

## How it works

- `server.js`: tiny Node server that serves the page and calls the Gemini API (the API key stays on the server, never in the browser).
- `index.html`: single-page front end; uses the browser's `speechSynthesis` for read-aloud and the camera/photo picker for documents.
- Gemini reads the text (or photo), then returns structured JSON: summary, steps, warning, and a translation.

## Limits and next steps

- Read-aloud quality depends on the voices installed on the user's device; some languages (e.g. Khmer, Burmese) may have no voice on some phones.
- Not medical or legal advice; it's a reading helper.
- Ideas: offline mode, reading-level score (original vs. simplified), saving past documents, SMS/WhatsApp version for people without smartphones.

## Built with

Node.js, vanilla JavaScript, Gemini API, Web Speech API. Code written with help from Claude during the hackathon period.

## License

MIT
