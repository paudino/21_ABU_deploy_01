
/**
 * Servizio per il recupero di notizie REALI da fonti giornalistiche esterne.
 * Utilizza feed RSS pubblici (Italiani e Internazionali) e una rotazione di proxy CORS.
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

/**
 * Proxy disponibili per bypassare i blocchi CORS del browser.
 */
const PROXY_STRATEGIES = [
  async (url: string) => {
    // AllOrigins è solitamente il più stabile per feed XML
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error("AllOrigins fail");
    const data = await res.json();
    return data.contents;
  },
  async (url: string) => {
    // Codetabs come seconda opzione
    const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error("Codetabs fail");
    return await res.text();
  },
  async (url: string) => {
    // CorsProxy.io è sensibile a certi URL, lo usiamo come fallback
    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error("Corsproxy fail");
    return await res.text();
  }
];

/**
 * Recupera notizie grezze provando diverse strategie di proxy in sequenza.
 */
export const fetchRawNewsFromRSS = async (category: string): Promise<RawNewsItem[]> => {
  const urls = RSS_FEEDS[category] || RSS_FEEDS['Generale'];
  
  // Ordiniamo mettendo i feed italiani (.it) per primi
  const sortedUrls = [...urls].sort((a, b) => {
      const isAIt = a.includes('.it') || a.includes('italiachecambia') || a.includes('avvenire');
      const isBIt = b.includes('.it') || b.includes('italiachecambia') || b.includes('avvenire');
      return isAIt === isBIt ? 0 : isAIt ? -1 : 1;
  });

  for (const baseUrl of sortedUrls) {
      // Rimosso cache-buster problematico per alcuni proxy
      const targetUrl = baseUrl;
      console.log(`%c[RSS-FETCH] Tentativo su: ${targetUrl}`, "color: #94a3b8");

      for (let i = 0; i < PROXY_STRATEGIES.length; i++) {
        try {
          const xmlText = await PROXY_STRATEGIES[i](targetUrl);
          
          if (!xmlText || xmlText.length < 100) throw new Error("Risposta vuota o troppo corta");

          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, "text/xml");
          
          // Verifica se è un XML valido
          if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
              // Prova a vedere se è un feed Atom (alcuni siti usano Atom invece di RSS)
              const entries = xmlDoc.querySelectorAll("entry");
              if (entries.length > 0) return parseAtom(xmlDoc);
              throw new Error("Errore parsing XML");
          }

          const items = xmlDoc.querySelectorAll("item");
          const news: RawNewsItem[] = [];
          
          items.forEach((item, index) => {
            if (index > 15) return; 
            news.push({
              title: item.querySelector("title")?.textContent || "",
              link: item.querySelector("link")?.textContent || "",
              description: item.querySelector("description")?.textContent?.replace(/<[^>]*>?/gm, '').substring(0, 400).trim() + "..." || "",
              pubDate: item.querySelector("pubDate")?.textContent || new Date().toISOString()
            });
          });
          
          if (news.length > 0) {
            console.log(`%c[RSS-SUCCESS] Recuperati ${news.length} elementi da ${baseUrl}`, "color: #10b981; font-weight: bold");
            return news;
          }
        } catch (error: any) {
          console.warn(`[PROXY-FAIL] Proxy ${i} ha fallito per ${baseUrl}: ${error.message}`);
          continue; 
        }
      }
  }

  console.error(`%c[RSS-FAIL] Nessun feed raggiungibile per: ${category}`, "color: #ef4444");
  return [];
};

/**
 * Parser per feed in formato Atom (alternativa a RSS)
 */
const parseAtom = (doc: Document): RawNewsItem[] => {
    const entries = doc.querySelectorAll("entry");
    const news: RawNewsItem[] = [];
    entries.forEach((entry, index) => {
        if (index > 15) return;
        news.push({
            title: entry.querySelector("title")?.textContent || "",
            link: entry.querySelector("link")?.getAttribute("href") || "",
            description: entry.querySelector("summary")?.textContent?.replace(/<[^>]*>?/gm, '').substring(0, 400).trim() + "..." || 
                         entry.querySelector("content")?.textContent?.replace(/<[^>]*>?/gm, '').substring(0, 400).trim() + "..." || "",
            pubDate: entry.querySelector("updated")?.textContent || entry.querySelector("published")?.textContent || new Date().toISOString()
        });
    });
    return news;
};
