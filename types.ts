

// Definizione dell'utente
export interface User {
  id: string;       // UUID di Supabase
  username: string; // Nome visualizzato
  avatar: string;   // URL avatar
}

// Definizione di un commento
export interface Comment {
  id: string;
  articleId: string; // Chiave logica per collegare all'articolo (UUID)
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

// Definizione dell'articolo generato dall'AI
export interface Article {
  id?: string; // UUID (presente se salvato su DB)
  title: string;
  summary: string;
  source: string;
  url: string; // URL univoco della notizia (legacy key)
  date: string;
  category: string;
  imageUrl?: string; 
  audioBase64?: string; // Cache dell'audio generato
  sentimentScore: number;
  isNew?: boolean; // Flag per indicare se è una notizia appena scaricata
  
  // Contatori Interazioni
  likeCount?: number;
  dislikeCount?: number;
}

// Categoria di notizie
export interface Category {
  id: string; // Identificativo unico (es. 'tech') o UUID
  label: string; // Nome visualizzato (es. Tecnologia)
  value: string; // Valore per il prompt AI (es. tecnologia innovazione)
}

// Nuove interfacce per Citazioni e Buoni Propositi
export interface Quote {
  id: string;
  text: string;
  author: string;
  createdAt?: string; // Opzionale per il frontend, ma presente nel DB
}

export interface Deed {
  id: string;
  text: string;
  createdAt?: string;
}

// Props comuni per i componenti
export interface BaseProps {
  className?: string;
}

// COSTANTI - Categorie richieste aggiornate con keywords più specifiche e distinte
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'tech', label: 'Tecnologia', value: 'tecnologia digitale, intelligenza artificiale, hardware, software, robotica, spazio, ingegneria, startup tech' },
  { id: 'med', label: 'Medicina', value: 'medicina, salute, cure mediche, ospedali, biologia, benessere fisico, scoperte farmaceutiche' },
  { id: 'pol', label: 'Politica', value: 'politica, cooperazione internazionale, trattati di pace, diritti civili, diplomazia, buone notizie istituzionali' },
  { id: 'env', label: 'Ambiente', value: 'ambiente, natura, ecologia, riforestazione, energie rinnovabili, pulizia oceani, salvaguardia animali' },
  { id: 'soc', label: 'Società', value: 'società, solidarietà, inclusione, volontariato, atti di gentilezza, storie di comunità, educazione' }
];