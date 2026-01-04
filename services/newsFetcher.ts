
/**
 * Servizio per il recupero di notizie REALI da fonti giornalistiche esterne.
 * Utilizza feed RSS pubblici e una rotazione di proxy CORS con fallback.
 */

const RSS_FEEDS: Record<string, string[]> = {
  'Generale': [
    'https://www.italiachecambia.org/feed/', 
    'https://www.greenme.it/feed/',
    'https://www.avvenire.it/rss/buone-notizie.xml',
    'https://www.lifegate.it/feed',
    'https://www.goodnewsnetwork.org/category/news/feed/'
  ],
  'Tecnologia': [
    'https://www.hdblog.it/rss/',
    'https://punto-informatico.it/feed/',
    'https://www.wired.it/rss/feed/',
    'https://phys.org/rss-feed/technology-news/'
  ],
  'Medicina': [
    'https://www.fondazioneveronesi.it/magazine/rss',
    'https://www.quotidianosanita.it/rss.php',
    'https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml',
    'https://www.goodnewsnetwork.org/category/news/health/feed/'
  ],
  'Ambiente': [
    'https://www.greenme.it/category/ambiente/feed/',
    'https://www.italiachecambia.org/categoria/ecologia/feed/',
    'https://www.rinnovabili.it/feed/',
    'https://www.goodnewsnetwork.org/category/news/earth/feed/'
  ],
  'Società': [
    'https://www.avvenire.it/rss/buone-notizie.xml',
    'https://www.italiachecambia.org/categoria/societa/feed/',
    'https://www.greenme.it/category/vivere/feed/'
  ],
  'Politica': [
    'https://www.italiachecambia.org/categoria/politica/feed/',
    'https://www.ansa.it/sito/notizie/mondo/mondo_rss.xml',
    'https://www.goodnewsnetwork.org/category/news/world/feed/'
  ]
};

export interface RawNewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

const PROXY_STRATEGIES = [
  async (url: string) => {
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}&disableCache=true`);
    if (!res.ok) throw new Error("AllOrigins fail");
    const data = await res.json();
    return data.contents;
  },
  async (url: string) => {
    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error("Corsproxy fail");
    return await res.text();
  }
];

export const fetchRawNewsFromRSS = async (category: string): Promise<RawNewsItem[]> => {
  const urls = RSS_FEEDS[category] || RSS_FEEDS['Generale'];
  const shuffledUrls = [...urls].sort(() => Math.random() - 0.5);

  for (const baseUrl of shuffledUrls) {
      for (const proxyFn of PROXY_STRATEGIES) {
        try {
          const xmlText = await proxyFn(baseUrl);
          if (!xmlText || xmlText.length < 100) continue;

          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, "text/xml");
          
          if (xmlDoc.getElementsByTagName("parsererror").length > 0) continue;

          // Gestione RSS Standard
          const items = xmlDoc.querySelectorAll("item");
          if (items.length > 0) {
            const news: RawNewsItem[] = [];
            items.forEach((item, index) => {
              if (index > 10) return; 
              news.push({
                title: item.querySelector("title")?.textContent || "Senza Titolo",
                link: item.querySelector("link")?.textContent || "",
                description: item.querySelector("description")?.textContent?.replace(/<[^>]*>?/gm, '').substring(0, 300).trim() || "",
                pubDate: item.querySelector("pubDate")?.textContent || new Date().toISOString()
              });
            });
            return news;
          }

          // Gestione Atom
          const entries = xmlDoc.querySelectorAll("entry");
          if (entries.length > 0) {
              const news: RawNewsItem[] = [];
              entries.forEach((entry, index) => {
                if (index > 10) return;
                news.push({
                    title: entry.querySelector("title")?.textContent || "Senza Titolo",
                    link: entry.querySelector("link")?.getAttribute("href") || "",
                    description: entry.querySelector("summary")?.textContent?.replace(/<[^>]*>?/gm, '') || 
                                 entry.querySelector("content")?.textContent?.replace(/<[^>]*>?/gm, '').substring(0, 300) || "",
                    pubDate: entry.querySelector("updated")?.textContent || new Date().toISOString()
                });
              });
              return news;
          }
        } catch (error) {
          console.warn(`[Proxy-Fail] Fallito recupero da ${baseUrl} usando proxy.`);
          continue; 
        }
      }
  }
  
  // Se tutto fallisce, restituiamo un piccolo set di notizie statiche di emergenza per non rompere la UI
  return [{
      title: "Il mondo continua a splendere",
      link: "https://www.goodnewsnetwork.org",
      description: "Nonostante i piccoli intoppi tecnici, ci sono migliaia di storie positive che aspettano di essere raccontate oggi.",
      pubDate: new Date().toISOString()
  }];
};
