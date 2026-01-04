
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
  async (url: string) => {
    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error("Corsproxy fail");
    return await res.text();
  },
  async (url: string) => {
    const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error("Codetabs fail");
    return await res.text();
  },
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
  const baseUrl = urls[Math.floor(Math.random() * urls.length)];
  
  // Anti-cache: aggiungiamo un timestamp alla URL
  const targetUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
  
  console.log(`%c[RSS-FETCH] Connessione a: ${targetUrl}`, "color: #94a3b8");

  for (let i = 0; i < PROXY_STRATEGIES.length; i++) {
    try {
      const xmlText = await PROXY_STRATEGIES[i](targetUrl);
      
      if (!xmlText || xmlText.length < 100) throw new Error("Risposta vuota");

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      if (xmlDoc.getElementsByTagName("parsererror").length > 0) throw new Error("Errore XML");

      const items = xmlDoc.querySelectorAll("item");
      const news: RawNewsItem[] = [];
      
      items.forEach((item, index) => {
        if (index > 15) return; 
        news.push({
          title: item.querySelector("title")?.textContent || "",
          link: item.querySelector("link")?.textContent || "",
          description: item.querySelector("description")?.textContent?.replace(/<[^>]*>?/gm, '').substring(0, 300) + "..." || "",
          pubDate: item.querySelector("pubDate")?.textContent || new Date().toISOString()
        });
      });
      
      if (news.length > 0) {
        console.log(`%c[RSS-SUCCESS] Recuperati ${news.length} elementi via Proxy #${i + 1}`, "color: #10b981; font-weight: bold");
        return news;
      }
    } catch (error: any) {
      console.warn(`%c[RSS-RETRY] Proxy #${i + 1} fallito: ${error.message}`, "color: #f59e0b");
      continue;
    }
  }

  console.error(`%c[RSS-FAIL] Tutti i proxy hanno fallito per: ${category}`, "color: #ef4444");
  return [];
};
