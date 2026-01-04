
/**
 * Servizio per il recupero di notizie REALI da fonti giornalistiche esterne.
 * Utilizza feed RSS pubblici e un proxy CORS per il browser.
 */

const RSS_FEEDS: Record<string, string[]> = {
  'Generale': ['https://www.goodnewsnetwork.org/category/news/feed/'],
  'Tecnologia': ['https://www.goodnewsnetwork.org/category/news/usa/feed/', 'https://phys.org/rss-feed/technology-news/'],
  'Medicina': ['https://www.goodnewsnetwork.org/category/news/health/feed/'],
  'Ambiente': ['https://www.goodnewsnetwork.org/category/news/earth/feed/'],
  'Società': ['https://www.goodnewsnetwork.org/category/news/inspiring/feed/'],
  'Politica': ['https://www.goodnewsnetwork.org/category/news/world/feed/']
};

export interface RawNewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

/**
 * Recupera notizie grezze da un feed RSS tramite proxy CORS.
 */
export const fetchRawNewsFromRSS = async (category: string): Promise<RawNewsItem[]> => {
  const urls = RSS_FEEDS[category] || RSS_FEEDS['Generale'];
  const targetUrl = urls[Math.floor(Math.random() * urls.length)];
  
  // Usiamo allorigins.win come proxy CORS gratuito e affidabile
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error("Errore proxy RSS");
    
    const data = await response.json();
    const xmlText = data.contents;
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const items = xmlDoc.querySelectorAll("item");
    
    const news: RawNewsItem[] = [];
    items.forEach((item, index) => {
      if (index > 10) return; // Prendiamo i primi 10 per l'analisi AI
      news.push({
        title: item.querySelector("title")?.textContent || "",
        link: item.querySelector("link")?.textContent || "",
        description: item.querySelector("description")?.textContent?.replace(/<[^>]*>?/gm, '').substring(0, 200) + "..." || "",
        pubDate: item.querySelector("pubDate")?.textContent || new Date().toISOString()
      });
    });
    
    return news;
  } catch (error) {
    console.error("Errore recupero RSS:", error);
    return [];
  }
};

