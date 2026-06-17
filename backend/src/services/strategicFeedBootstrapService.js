import { createFeed as createFeedRecord, findFeedByRssUrl, updateFeed as updateFeedRecord } from "../database/feedRepository.js";

function buildGoogleNewsRssUrl(query) {
  const encodedQuery = encodeURIComponent(String(query || "").trim());
  return `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;
}

const PHASE_ONE_STRATEGIC_FEEDS = [
  // ICAO
  {
    name: "ICAO Newsroom",
    topic: "Identity Documents",
    rssUrl: "https://www.icao.int/news",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "ICAO TRIP",
    topic: "Identity Documents",
    rssUrl: "https://www.icao.int/facilitation-programmes/assistance",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "ICAO PKD",
    topic: "Identity Documents",
    rssUrl: buildGoogleNewsRssUrl('"ICAO PKD"'),
    sourceType: "rss",
    phase: "phase1",
  },
  {
    name: "ICAO Doc 9303",
    topic: "Identity Documents",
    rssUrl: buildGoogleNewsRssUrl('"Doc 9303"'),
    sourceType: "rss",
    phase: "phase1",
  },
  {
    name: "ICAO Digital Travel Credential",
    topic: "Identity Documents",
    rssUrl: buildGoogleNewsRssUrl('"Digital Travel Credential"'),
    sourceType: "rss",
    phase: "phase1",
  },
  {
    name: "ICAO Traveller Identification Programme",
    topic: "Identity Documents",
    rssUrl: buildGoogleNewsRssUrl('"Traveller Identification Programme"'),
    sourceType: "rss",
    phase: "phase1",
  },

  // Residence permits
  {
    name: "UKVI BRP and BRC Guidance",
    topic: "Identity Documents",
    rssUrl: "https://www.gov.uk/government/publications/biometric-residence-permits-guidance",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "UKVI Biometric Residence Permits",
    topic: "Identity Documents",
    rssUrl: "https://www.gov.uk/biometric-residence-permits",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "Dutch IND Residence Updates",
    topic: "Identity Documents",
    rssUrl: "https://ind.nl/en/news",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "Swedish Migration Agency Residence Permit Cards",
    topic: "Identity Documents",
    rssUrl: "https://www.migrationsverket.se/en/word-explanations/residence-permit-cards.html",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "Residence Permit Card",
    topic: "Identity Documents",
    rssUrl: buildGoogleNewsRssUrl('"Residence Permit Card"'),
    sourceType: "rss",
    phase: "phase1",
  },
  {
    name: "Biometric Residence Permit",
    topic: "Identity Documents",
    rssUrl: buildGoogleNewsRssUrl('"Biometric Residence Permit"'),
    sourceType: "rss",
    phase: "phase1",
  },

  // Border control
  {
    name: "eu-LISA Updates",
    topic: "Identity Documents",
    rssUrl: "https://www.eulisa.europa.eu/news-and-events",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "CBP Newsroom",
    topic: "Identity Documents",
    rssUrl: "https://www.cbp.gov/newsroom",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "CBP Mobile Passport Control",
    topic: "Identity Documents",
    rssUrl: "https://www.cbp.gov/travel/us-citizens/mobile-passport-control?t=i",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "Frontex Newsroom",
    topic: "Identity Documents",
    rssUrl: "https://www.frontex.europa.eu/media-centre/news/",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "Entry Exit System",
    topic: "Identity Documents",
    rssUrl: buildGoogleNewsRssUrl('"Entry Exit System"'),
    sourceType: "rss",
    phase: "phase1",
  },
  {
    name: "Automated Border Control",
    topic: "Identity Documents",
    rssUrl: buildGoogleNewsRssUrl('"Automated Border Control"'),
    sourceType: "rss",
    phase: "phase1",
  },

  // Industry sources
  {
    name: "Keesing Platform",
    topic: "Identity Documents",
    rssUrl: "https://platform.keesingtechnologies.com/",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "Security Document World",
    topic: "Identity Documents",
    rssUrl: "https://www.securitydocumentworld.com/",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "Regula News",
    topic: "Identity Documents",
    rssUrl: "https://regulaforensics.com/news/",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "Veridos Press & Media",
    topic: "Identity Documents",
    rssUrl: "https://www.veridos.com/en/about/press-media/",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "IN Groupe Newsroom",
    topic: "Identity Documents",
    rssUrl: "https://ingroupe.com/newsroom/",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "Bundesdruckerei Press Releases",
    topic: "Identity Documents",
    rssUrl: "https://www.bundesdruckerei.de/en/newsroom/press-releases",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "G+D Press Releases",
    topic: "Shared Security Printing",
    rssUrl: "https://www.gi-de.com/en/about-us/press/press-releases",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "Crane Currency News & Insights",
    topic: "Banknotes",
    rssUrl: "https://www.cranecurrency.com/news-insights/",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "HID Press Releases",
    topic: "Identity Documents",
    rssUrl: "https://newsroom.hidglobal.com/press-releases",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "KURZ Press Releases",
    topic: "Shared Security Printing",
    rssUrl: "https://www.kurz-world.com/en/newsroom/press/",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "SICPA Newsroom",
    topic: "Shared Security Printing",
    rssUrl: "https://www.sicpa.com/all-press-releases",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "SURYS Newsroom",
    topic: "Shared Security Printing",
    rssUrl: "https://surys.com/surys-blog/",
    sourceType: "website",
    phase: "phase1",
  },
  {
    name: "IQ Structures Newsroom",
    topic: "Shared Security Printing",
    rssUrl: "https://www.iqstructures.com/en/blog",
    sourceType: "website",
    phase: "phase1",
  },
];

const RETIRED_STRATEGIC_FEEDS = [
  {
    name: "Cetis RSS",
    rssUrl: "http://www.cetis.si/?mod=aktualno&action=rss&lang=en",
  },
  {
    name: "Authentix RSS",
    rssUrl: "https://authentix.com/feed/",
  },
  {
    name: "Security Foiling RSS",
    rssUrl: "https://www.securityfoiling.com/feed/",
  },
  {
    name: "SICPA RSS",
    rssUrl: "https://www.sicpa.com/rss.xml",
  },
  {
    name: "SURYS RSS",
    rssUrl: "https://surys.com/feed/",
  },
  {
    name: "IDEMIA Pressroom",
    rssUrl: "https://www.idemia.com/pressroom",
  },
];

export async function ensureStrategicFeeds() {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let retired = 0;
  const feedsNeedingInitialSync = [];

  for (const definition of RETIRED_STRATEGIC_FEEDS) {
    try {
      const existing = await findFeedByRssUrl(definition.rssUrl);
      if (!existing || existing.isActive === false) {
        continue;
      }

      await updateFeedRecord(existing.id, {
        isActive: false,
      });
      retired += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `[strategic-feeds] Failed to retire ${definition.name} (${definition.rssUrl}):`,
        error?.stack || error
      );
    }
  }

  for (const definition of PHASE_ONE_STRATEGIC_FEEDS) {
    try {
      const existing = await findFeedByRssUrl(definition.rssUrl);
      if (!existing) {
        const createdFeed = await createFeedRecord({
          name: definition.name,
          topic: definition.topic,
          rssUrl: definition.rssUrl,
          sourceType: definition.sourceType,
          isActive: true,
        });
        feedsNeedingInitialSync.push(createdFeed);
        console.log(
          `[strategic-feeds] created name=${definition.name} sourceType=${definition.sourceType} rssUrl=${definition.rssUrl}`
        );
        created += 1;
        continue;
      }

      const needsUpdate =
        existing.name !== definition.name ||
        existing.topic !== definition.topic ||
        existing.sourceType !== definition.sourceType ||
        existing.isActive !== true;

      if (!needsUpdate) {
        if (existing.isActive !== false && !existing.lastFetchedAt) {
          feedsNeedingInitialSync.push(existing);
          console.log(
            `[strategic-feeds] initial-sync-pending name=${existing.name} sourceType=${existing.sourceType} feedId=${existing.id} rssUrl=${existing.rssUrl}`
          );
        }
        skipped += 1;
        continue;
      }

      const updatedFeed = await updateFeedRecord(existing.id, {
        name: definition.name,
        topic: definition.topic,
        sourceType: definition.sourceType,
        isActive: true,
      });
      if (updatedFeed?.isActive !== false && !updatedFeed?.lastFetchedAt) {
        feedsNeedingInitialSync.push(updatedFeed);
      }
      console.log(
        `[strategic-feeds] updated name=${definition.name} sourceType=${definition.sourceType} feedId=${existing.id} rssUrl=${definition.rssUrl}`
      );
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `[strategic-feeds] Failed to ensure ${definition.name} (${definition.rssUrl}):`,
        error?.stack || error
      );
    }
  }

  console.log(
    `[strategic-feeds] Phase 1 feed bootstrap complete: created=${created} updated=${updated} skipped=${skipped} retired=${retired} failed=${failed}`
  );

  return {
    created,
    updated,
    skipped,
    retired,
    failed,
    feedsNeedingInitialSync,
  };
}
