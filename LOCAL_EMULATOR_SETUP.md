# Local Emulator Persistence

The Firebase emulators in this project now support persistent local data.

## Start the app with persistence

From the project root:

```bash
npm run emulators:start
```

This starts Hosting, Functions, and Firestore with:

- import path: `.firebase/demo-rss-monitor`
- export on exit: `.firebase/demo-rss-monitor`

That means feeds and articles added locally will be restored the next time you start the emulators, as long as you stop them cleanly.

## Seed local data

If your local emulator is empty, seed it with:

```bash
npm run emulators:seed
```

By default this reads:

`functions/scripts/seed-data.json`

If that file does not exist, it falls back to:

`functions/scripts/seed-data.example.json`

You can also pass a custom file:

```bash
node functions/scripts/seed-emulator.js /absolute/path/to/seed-data.json
```

## Seed file format

```json
{
  "feeds": [
    {
      "id": "feed-1",
      "name": "Google Alerts",
      "rssUrl": "https://www.google.com/alerts/feeds/...",
      "isActive": true,
      "createdAt": "2026-03-16T12:00:00.000Z"
    }
  ],
  "articles": [
    {
      "id": "article-1",
      "title": "Example article",
      "link": "https://example.com/article",
      "pubDate": "2026-03-16T12:05:00.000Z",
      "source": "Example News",
      "topic": "Google Alerts",
      "thumbnail": "https://placehold.co/800x450/f3f6fb/9aa7b8?text=No+Image",
      "feedId": "feed-1",
      "createdAt": "2026-03-16T12:05:00.000Z"
    }
  ]
}
```

## Important note

Your previous emulator-only feeds were lost when the old emulator instance was restarted without import/export enabled. They cannot be recovered automatically unless they were exported beforehand.
