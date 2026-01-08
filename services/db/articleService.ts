
import { supabase } from '../supabaseClient';
import { Article } from '../../types';

export const cleanupOldArticles = async (): Promise<void> => {
    try { await supabase.rpc('cleanup_old_articles'); } catch (e) {}
};

export const getCachedArticles = async (categoryLabel: string, categoryId?: string): Promise<Article[]> => {
    const cleanLabel = categoryLabel ? categoryLabel.trim() : '';
    const cleanId = categoryId ? categoryId.trim() : '';
    
    console.log(`[DB-Service] Ricerca articoli per - Label: "${cleanLabel}", ID: "${cleanId}"`);

    try {
        let query = supabase.from('articles').select('*');

        // Costruiamo un filtro OR robusto che copra tutte le possibilità di salvataggio
        const filterParts = [];
        if (cleanLabel) {
            filterParts.push(`category.ilike.%${cleanLabel}%`);
            filterParts.push(`category.eq."${cleanLabel}"`);
        }
        if (cleanId) {
            filterParts.push(`category.eq."${cleanId}"`);
        }

        if (filterParts.length > 0) {
            query = query.or(filterParts.join(','));
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(40);

        if (error) {
            console.error("[DB-Service] Errore query Supabase:", error.message);
            return [];
        }

        if (!data || data.length === 0) {
            console.warn(`[DB-Service] Nessun articolo trovato per "${cleanLabel}/${cleanId}". Verificare RLS o nomi tabelle.`);
            return [];
        }
        
        console.log(`[DB-Service] Successo: Trovati ${data.length} articoli.`);
        
        // Mapping ultra-robusto per prevenire crash da dati nulli/inaspettati
        return data.map((a: any) => {
            try {
                // Gestione flessibile della data
                let formattedDate = a.published_date || a.date;
                if (!formattedDate && a.created_at) {
                    formattedDate = new Date(a.created_at).toISOString().split('T')[0];
                } else if (!formattedDate) {
                    formattedDate = new Date().toISOString().split('T')[0];
                }

                return {
                    id: a.id,
                    title: String(a.title || 'Senza Titolo'),
                    summary: String(a.summary || 'Nessun riassunto disponibile.'),
                    source: String(a.source || 'Fonte Sconosciuta'),
                    url: a.url,
                    date: formattedDate,
                    category: a.category || cleanLabel,
                    imageUrl: a.image_url || '',
                    audioBase64: a.audio_base64 || '',
                    sentimentScore: Number(a.sentiment_score || 0.85),
                    likeCount: 0,
                    dislikeCount: 0
                };
            } catch (err) {
                console.error("[DB-Service] Errore mapping record:", a.id, err);
                return null;
            }
        }).filter(Boolean) as Article[];

    } catch (e: any) {
        console.error("[DB-Service] Eccezione fatale nel recupero cache:", e.message);
        return [];
    }
};

export const saveArticles = async (categoryLabel: string, articles: Article[]): Promise<Article[]> => {
    if (!articles || articles.length === 0) return [];
    
    console.log(`[DB-Service] Salvataggio di ${articles.length} articoli per ${categoryLabel}.`);
    const savedArticles: Article[] = [];

    for (const article of articles) {
        if (!article.url) continue;

        // Salviamo usando sia la Label che l'ID per coerenza futura
        const row = {
            url: article.url, 
            category: article.category || categoryLabel,
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
                savedArticles.push({ ...article, id: data.id });
            }
        } catch (e) {
            console.warn("[DB-Service] Upsert fallito per:", article.url);
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
