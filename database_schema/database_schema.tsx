
export const databaseSchema = `
-- ============================================================================
-- ⚠️ ESEGUI QUESTO SCRIPT NEL 'SQL EDITOR' DI SUPABASE ⚠️
-- Crea le tabelle mancanti e risolve i permessi.
-- ============================================================================

-- 0. CREAZIONE TABELLE MANCANTI (Se non esistono)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username TEXT,
  avatar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  category TEXT,
  title TEXT,
  summary TEXT,
  source TEXT,
  published_date TEXT,
  image_url TEXT,
  audio_base64 TEXT,
  sentiment_score NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Aggiornamento tabella CATEGORIES con user_id
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL = Categoria Pubblica
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Se la tabella esisteva già senza user_id, aggiungiamolo
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='user_id') THEN 
        ALTER TABLE categories ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE; 
    END IF; 
END $$;

CREATE TABLE IF NOT EXISTS likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, article_id)
);

CREATE TABLE IF NOT EXISTS dislikes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, article_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  username TEXT,
  text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, article_id)
);

CREATE TABLE IF NOT EXISTS quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT UNIQUE NOT NULL,
  author TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS deeds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- RESET POLICIES (RLS)
-- ============================================================================

-- 1. Reset Policy Preferiti (Permetti Tutto)
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Favorites Full Access" ON favorites;
CREATE POLICY "Favorites Full Access" ON favorites FOR ALL USING (true) WITH CHECK (true);

-- 2. Reset Policy Articoli
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Articles Access" ON articles;
CREATE POLICY "Public Articles Access" ON articles FOR ALL USING (true) WITH CHECK (true);

-- 3. Reset Policy Categorie (LOGICA PRIVACY AGGIORNATA)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Categories Access" ON categories;
DROP POLICY IF EXISTS "Categories Access" ON categories;

-- Chiunque può leggere le categorie pubbliche (user_id IS NULL)
-- Gli utenti loggati possono leggere le proprie (user_id = auth.uid())
CREATE POLICY "Categories Access" ON categories 
FOR ALL 
USING (
    user_id IS NULL OR 
    (auth.uid() IS NOT NULL AND user_id = auth.uid()::uuid)
)
WITH CHECK (
    -- Solo gli utenti loggati possono inserire/modificare le PROPRIE categorie
    auth.uid() IS NOT NULL AND user_id = auth.uid()::uuid
);

-- 4. Reset Policy Like/Dislike/Comments/Users
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Likes Access" ON likes;
CREATE POLICY "Public Likes Access" ON likes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE dislikes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Dislikes Access" ON dislikes;
CREATE POLICY "Public Dislikes Access" ON dislikes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Comments Access" ON comments;
CREATE POLICY "Public Comments Access" ON comments FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Users Access" ON users;
CREATE POLICY "Public Users Access" ON users FOR ALL USING (true) WITH CHECK (true);

-- 5. Reset Policy Quotes/Deeds
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Quotes Access" ON quotes;
CREATE POLICY "Public Quotes Access" ON quotes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE deeds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Deeds Access" ON deeds;
CREATE POLICY "Public Deeds Access" ON deeds FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. OTTIMIZZAZIONE E PULIZIA
-- ============================================================================

-- Funzione di pulizia (opzionale)
CREATE OR REPLACE FUNCTION cleanup_old_articles()
RETURNS void AS $$
BEGIN
  -- Esempio: cancella articoli più vecchi di 60 giorni se non sono nei preferiti
  DELETE FROM articles 
  WHERE created_at < NOW() - INTERVAL '60 days'
  AND id NOT IN (SELECT article_id FROM favorites);
END;
$$ LANGUAGE plpgsql;

-- Indici per velocità
CREATE INDEX IF NOT EXISTS idx_favorites_user_article ON favorites(user_id, article_id);
CREATE INDEX IF NOT EXISTS idx_favorites_article ON favorites(article_id);
CREATE INDEX IF NOT EXISTS idx_likes_article ON likes(article_id);
CREATE INDEX IF NOT EXISTS idx_dislikes_article ON dislikes(article_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);

-- Conferma
SELECT 'Database aggiornato correttamente. Ricarica la pagina.' as status;
`;
