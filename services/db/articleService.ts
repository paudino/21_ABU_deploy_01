
import { supabase } from '../supabaseClient';
import { Article } from '../../types';

export const cleanupOldArticles = async (): Promise<void> => {
    try { await supabase.rpc('cleanup_old_articles'); } catch (e) {}
};

export const getCachedArticles = async (categoryLabel: string, categoryId?: string): Promise<Article[]> => {
    const cleanLabel = categoryLabel ? categoryLabel.trim() : '';
    const cleanId = categoryId ? categoryId.trim() : '';
    
    console.log(`[DB-Service] Tentativo recupero cache per Label: "${cleanLabel}" o ID: "${cleanId}"`);

    try {
        // Query più flessibile: cerca sia per Label che per ID (se fornito)
        let query = supabase
          .from('articles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        if (cleanLabel && cleanId) {
            query = query.or(`category.ilike.%${cleanLabel}%,category.eq.${cleanId}`);
        } else if (cleanLabel) {
            query = query.ilike('category', `%${cleanLabel}%`);
        }

        const { data, error } = await query;

        if (error) {
            console.error("[DB-Service] Errore query Supabase:", error.message);
            return [];
        }

        if (!data || data.length === 0) {
            console.log("[DB-Service] Nessun dato trovato in cache per i criteri specificati.");
            return [];
        }
        
        console.log(`[DB-Service] Successo: Trovati ${data.length} articoli.`);
        
        // Mapping ultra-robusto: se un campo fallisce, non blocca l'intero array
        return data.map((a: any) => {
            try {
                let formattedDate = a.published_date || a.date;
                if (!formattedDate && a.created_at) {
                    formattedDate = new Date(a.created_at).toISOString().split('T')[0];
                }

                return {
                    id: a.id,
                    title: a.title || 'Senza Titolo',
                    summary: a.summary || 'Nessun riassunto disponibile.',
                    source: a.source || 'Fonte Sconosciuta',
                    url: a.url,
                    date: formattedDate || new Date().toISOString().split('T')[0],
                    category: a.category,
                    imageUrl: a.image_url || '',
                    audioBase64: a.audio_base64 || '',
                    sentimentScore: a.sentiment_score || 0.85,
                    likeCount: 0,
                    dislikeCount: 0
                };
            } catch (err) {
                console.warn("[DB-Service] Errore mapping singolo articolo:", err);
                return null;
            }
        }).filter(Boolean) as Article[];

    } catch (e: any) {
        console.error("[DB-Service] Eccezione fatale fetch cache:", e.message);
        return [];
    }
};

export const saveArticles = async (categoryLabel: string, articles: Article[]): Promise<Article[]> => {
    if (!articles || articles.length === 0) return [];
    
    console.log(`[DB-Service] Salvataggio di ${articles.length} articoli.`);
    const savedArticles: Article[] = [];
    const cleanCategory = (categoryLabel || 'Generale').trim();

    for (const article of articles) {
        if (!article.url) continue;

        const row = {
            url: article.url, 
            category: article.category || cleanCategory,
            title: article.title,
            summary: article.summary,
            source: article.source,
            published_date: article.date, 
            sentiment_score: article.sentimentScore,
            image_url: article.imageUrl || null,
            audio_base64: article.audioBase64 || null
        };

        try {
            const { data, error } = await supabase
                .from('articles')
                .upsert(row, { onConflict: 'url' })
                .select()
                .single();

            if (data) {
                savedArticles.push({
                    ...article,
                    id: data.id
                });
            }
        } catch (e) {
            console.warn("[DB-Service] Upsert fallito:", article.url);
        }
    }
    
    return savedArticles;
};

export const updateArticleImage = async (articleUrl: string, imageUrl: string): Promise<void> => {
    try { await supabase.from('articles').update({ image_url: imageUrl }).eq('url', articleUrl); } catch (e) {}
};

export const updateArticleAudio = async (articleUrl: string, audioBase64: string): Promise<void> => {
    try { await supabase.from('articles').update({ audio_base64: audioBase64 }).eq('url', articleUrl); } catch (e) {}
};
