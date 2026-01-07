
/**
 * Servizio per il recupero di notizie REALI da fonti giornalistiche esterne.
 * Ottimizzato per la resilienza in produzione (Vercel).
 */

const RSS_FEEDS: Record<string, string[]> = {
  'Generale': [
    'https://www.goodnewsnetwork.org/category/news/feed/',
    'https://www.italiachecambia.org/feed/', 
    'https://www.greenme.it/feed/',
    'https://www.avvenire.it/rss/buone-notizie.xml'
  ],
  'Tecnologia': [
    'https://www.hdblog.it/rss/',
    'https://punto-informatico.it/feed/',
    'https://phys.org/rss-feed/technology-news/'
  ],
  'Medicina': [
    'https://www.fondazioneveronesi.it/magazine/rss',
    'https://www.quotidianosanita.it/rss.php',
    'https://www.goodnewsnetwork.org/category/news/health/feed/'
  ],
  'Ambiente': [
    'https://www.greenme.it/category/ambiente/feed/',
    'https://www.rinnovabili.it/feed/',
    'https://www.goodnewsnetwork.org/category/news/earth/feed/'
  ],
  'Società': [
    'https://www.italiachecambia.org/categoria/societa/feed/',
    'https://www.greenme.it/category/vivere/feed/'
  ],
  'Politica': [
    'https://www.italiachecambia.org/categoria/politica/feed/',
    'https://www.goodnewsnetwork.org/category/news/world/feed/'
  ]
};

const EMERGENCY_FALLBACK_NEWS: RawNewsItem[] = [
  {
    title: "Innovazione sostenibile: scoperte nuove frontiere",
    link: "https://www.greenme.it",
    description: "La scienza continua a fare passi da gigante verso un futuro più pulito e luminoso.",
    pubDate: new Date().toISOString()
  },
  {
    title: "Solidarietà globale: uniti per il bene comune",
    link: "https://www.goodnewsnetwork.org",
    description: "Storie di persone che fanno la differenza ogni giorno con piccoli e grandi gesti.",
    pubDate: new Date().toISOString()
  }
];

export interface RawNewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

const fetchWithTimeout = async (url: string, options: any = {}, timeout = 8000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(id);
    }
};

const PROXY_STRATEGIES = [
  {
    name: "CorsProxy.io",
    fn: async (url: string) => {
      const res = await fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    }
  },
  {
    name: "YACDN",
    fn: async (url: string) => {
      const res = await fetchWithTimeout(`https://yacdn.org/proxy/${url}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    }
  },
  {
    name: "AllOrigins",
    fn: async (url: string) => {
      const res = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}&disableCache=true`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.contents;
    }
  }
];

export const fetchRawNewsFromRSS = async (category: string): Promise<RawNewsItem[]> => {
  console.log(`[DIAGNOSTIC-RSS] Inizio recupero per: ${category}`);
  const urls = RSS_FEEDS[category] || RSS_FEEDS['Generale'];
  const shuffledUrls = [...urls].sort(() => Math.random() - 0.5);

  for (const baseUrl of shuffledUrls) {
      for (const strategy of PROXY_STRATEGIES) {
        try {
          console.log(`[DIAGNOSTIC-RSS] Tentativo con ${strategy.name} su: ${baseUrl}`);
          const xmlText = await strategy.fn(baseUrl);
          
          if (!xmlText || xmlText.length < 50) {
            console.warn(`[DIAGNOSTIC-RSS] Risposta troppo corta da ${strategy.name}`);
            continue;
          }

          const parser = new DOMParser();
          let xmlDoc = parser.parseFromString(xmlText, "text/xml");
          
          if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
             xmlDoc = parser.parseFromString(xmlText, "application/xml");
          }

          const results = parseXmlResponse(xmlDoc);
          if (results.length > 0) {
              console.log(`[DIAGNOSTIC-RSS] SUCCESS: ${results.length} news da ${strategy.name}`);
              return results;
          }
        } catch (error: any) {
          console.warn(`[DIAGNOSTIC-RSS] Fallimento ${strategy.name}:`, error.message);
          continue; 
        }
      }
  }
  
  console.error("[DIAGNOSTIC-RSS] Tutte le strategie fallite. Fallback attivo.");
  return EMERGENCY_FALLBACK_NEWS;
};

function parseXmlResponse(xmlDoc: Document): RawNewsItem[] {
    const news: RawNewsItem[] = [];
    const items = xmlDoc.querySelectorAll("item");
    
    if (items.length > 0) {
        items.forEach((item, index) => {
            if (index >= 12) return; 
            news.push({
                title: item.querySelector("title")?.textContent || "Notizia Positiva",
                link: item.querySelector("link")?.textContent || "",
                description: cleanContent(item.querySelector("description")?.textContent || ""),
                pubDate: item.querySelector("pubDate")?.textContent || new Date().toISOString()
            });
        });
        return news;
    }

    const entries = xmlDoc.querySelectorAll("entry");
    if (entries.length > 0) {
        entries.forEach((entry, index) => {
            if (index >= 12) return;
            news.push({
                title: entry.querySelector("title")?.textContent || "Notizia Positiva",
                link: entry.querySelector("link")?.getAttribute("href") || entry.querySelector("link")?.textContent || "",
                description: cleanContent(entry.querySelector("summary")?.textContent || entry.querySelector("content")?.textContent || ""),
                pubDate: entry.querySelector("updated")?.textContent || new Date().toISOString()
            });
        });
        return news;
    }

    return news;
}

function cleanContent(html: string): string {
    if (!html) return "";
    return html.replace(/<[^>]*>?/gm, '')
               .replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/&quot;/g, '"')
               .replace(/\s+/g, ' ')
               .substring(0, 400)
               .trim();
}
