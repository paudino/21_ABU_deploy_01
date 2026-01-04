
import { supabase } from '../supabaseClient';
import { Quote, Deed } from '../../types';

export const getRandomQuote = async (): Promise<Quote | null> => {
    try {
        const { count } = await supabase.from('quotes').select('*', { count: 'exact', head: true });
        if (!count) return null;
        const randomIndex = Math.floor(Math.random() * count);
        const { data } = await supabase.from('quotes').select('*').range(randomIndex, randomIndex).maybeSingle();
        return data as Quote;
    } catch(e) { return null; }
};

export const saveQuote = async (quote: Quote): Promise<void> => {
    try {
        const { data } = await supabase.from('quotes').select('id').eq('text', quote.text).maybeSingle();
        if (!data) {
             await supabase.from('quotes').insert([{ text: quote.text, author: quote.author }]);
        }
    } catch (e) {}
};

export const getRandomDeed = async (): Promise<Deed | null> => {
    try {
        const { count } = await supabase.from('deeds').select('*', { count: 'exact', head: true });
        if (!count) return null;
        const randomIndex = Math.floor(Math.random() * count);
        const { data } = await supabase.from('deeds').select('*').range(randomIndex, randomIndex).maybeSingle();
        return data as Deed;
    } catch(e) { return null; }
};

export const saveDeed = async (text: string): Promise<void> => {
    try {
        const { data } = await supabase.from('deeds').select('id').eq('text', text).maybeSingle();
        if (!data) {
            await supabase.from('deeds').insert([{ text }]);
        }
    } catch(e) {}
};

/**
 * Popola il DB con contenuti REALI e VERIFICATI al primo avvio.
 */
export const seedInspiration = async () => {
    const { count: qCount } = await supabase.from('quotes').select('*', { count: 'exact', head: true });
    if (!qCount || qCount < 5) {
        const initialQuotes = [
            { text: "La felicità non è qualcosa di già pronto. Viene dalle tue azioni.", author: "Dalai Lama" },
            { text: "Sii il cambiamento che vuoi vedere nel mondo.", author: "Mahatma Gandhi" },
            { text: "La gentilezza a parole crea confidenza. La gentilezza nel pensiero crea profondità.", author: "Lao Tzu" },
            { text: "Non è mai troppo tardi per essere ciò che avresti potuto essere.", author: "George Eliot" },
            { text: "Pensa, credi, sogna e osa.", author: "Walt Disney" }
        ];
        await supabase.from('quotes').insert(initialQuotes);
    }

    const { count: dCount } = await supabase.from('deeds').select('*', { count: 'exact', head: true });
    if (!dCount || dCount < 5) {
        const initialDeeds = [
            { text: "Lascia una recensione positiva a un piccolo business locale che apprezzi." },
            { text: "Invia un messaggio di ringraziamento a un vecchio insegnante o mentore." },
            { text: "Offri un caffè o un pasto a chi ne ha bisogno oggi." },
            { text: "Dedica 10 minuti a raccogliere piccoli rifiuti nel tuo quartiere." },
            { text: "Fai un complimento sincero alla prima persona con cui parlerai oggi." }
        ];
        await supabase.from('deeds').insert(initialDeeds);
    }
};
