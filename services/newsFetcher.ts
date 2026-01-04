
/**
 * Servizio per il recupero di notizie REALI da fonti giornalistiche esterne.
 * Utilizza feed RSS pubblici e una rotazione di proxy CORS per garantire resilienza.
 */

const RSS_FEEDS: Record<string, string[]> = {
  'Generale': ['https://www.goodnewsnetwork.org/category/news/feed/'],
  'Tecnologia': ['https://phys.org/rss-feed/technology-news/', 'https://www.goodnewsnetwork.org/category/news/usa/feed/'],
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
 * Proxy disponibili per bypassare i blocchi CORS del browser.
 */
const PROXY_STRATEGIES = [
  // Strategia 1: Corsproxy.io (Veloce e diretto)
  async (url: string) => {
    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error("Corsproxy fail");
    return await res.text();
  },
  // Strategia 2: Codetabs (Ottimo fallback)
  async (url: string) => {
    const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error("Codetabs fail");
    return await res.text();
  },
  // Strategia 3: AllOrigins (Restituisce un oggetto JSON con .contents)
  async (url: string) => {
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error("AllOrigins fail");
    const data = await res.json();
    return data.contents;
  }
];

/**
 * Recupera notizie grezze provando diverse strategie di proxy in sequenza.
 */
export const fetchRawNewsFromRSS = async (category: string): Promise<RawNewsItem[]> => {
  const urls = RSS_FEEDS[category] || RSS_FEEDS['Generale'];
  const targetUrl = urls[Math.floor(Math.random() * urls.length)];
  
  console.log(`%c[RSS-FETCH] Tentativo di connessione a: ${targetUrl}`, "color: #94a3b8");

  for (let i = 0; i < PROXY_STRATEGIES.length; i++) {
    try {
      console.log(`%c[RSS-FETCH] Utilizzo Proxy #${i + 1}...`, "color: #94a3b8");
      const xmlText = await PROXY_STRATEGIES[i](targetUrl);
      
      if (!xmlText || xmlText.length < 100) throw new Error("Risposta troppo corta");

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      
      // Controllo se il parsing ha prodotto errori (es. HTML invece di XML)
      const parseError = xmlDoc.getElementsByTagName("parsererror");
      if (parseError.length > 0) throw new Error("Errore parsing XML");

      const items = xmlDoc.querySelectorAll("item");
      const news: RawNewsItem[] = [];
      
      items.forEach((item, index) => {
        if (index > 10) return; 
        news.push({
          title: item.querySelector("title")?.textContent || "",
          link: item.querySelector("link")?.textContent || "",
          description: item.querySelector("description")?.textContent?.replace(/<[^>]*>?/gm, '').substring(0, 250) + "..." || "",
          pubDate: item.querySelector("pubDate")?.textContent || new Date().toISOString()
        });
      });
      
      if (news.length > 0) {
        console.log(`%c[RSS-SUCCESS] Recuperati ${news.length} elementi via Proxy #${i + 1}`, "color: #10b981; font-weight: bold");
        return news;
      }
    } catch (error: any) {
      console.warn(`%c[RSS-RETRY] Proxy #${i + 1} fallito: ${error.message}`, "color: #f59e0b");
      continue; // Prova il prossimo proxy
    }
  }

  console.error(`%c[RSS-FAIL] Tutti i proxy hanno fallito per la categoria: ${category}`, "color: #ef4444; font-weight: bold");
  return [];
};
