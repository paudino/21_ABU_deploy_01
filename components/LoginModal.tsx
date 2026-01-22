
import React, { useState, useEffect } from 'react';
import { IconX } from './Icons';
import { db } from '../services/dbService';
import { Tooltip } from './Tooltip';

interface LoginModalProps {
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Stato per mostrare/nascondere password
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isFileProtocol, setIsFileProtocol] = useState(false);

  useEffect(() => {
    if (window.location.protocol === 'file:') {
        setIsFileProtocol(true);
        setError("ATTENZIONE: Il login Google richiede un server web (http/https).");
    }
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    // Sanitizzazione input
    const cleanEmail = email.replace(/['"\s]+/g, '').toLowerCase();
    const cleanPassword = password.trim();

    try {
      if (activeTab === 'register') {
        // REGISTRAZIONE
        const { error, data } = await db.signUpWithEmail(cleanEmail, cleanPassword);
        if (error) throw error;
        
        // Successo
        setSuccessMsg("Operazione effettuata con successo.");
        
        // Se la sessione è attiva, switcha al login o chiudi
        if (data?.session) {
             setTimeout(() => {
                 onClose(); // Chiudi direttamente se loggato
             }, 1500);
        } else if (data?.user && !data.session) {
             // Caso email confirmation attiva
             setSuccessMsg("Registrazione riuscita! Se richiesto, controlla l'email per confermare l'account.");
        }

      } else {
        // LOGIN
        const { error } = await db.signInWithEmail(cleanEmail, cleanPassword);
        if (error) throw error;
        onClose(); 
      }
    } catch (err: any) {
      console.error("Errore Auth Completo:", err);
      let msg = err.message || "Si è verificato un errore sconosciuto.";
      
      // Traduzione e mappatura errori Supabase
      const msgLower = msg.toLowerCase();
      
      if (msgLower.includes("invalid login credentials")) {
          msg = "Email o password errati. Se ti sei appena registrato, verifica se devi confermare l'email.";
      } else if (msgLower.includes("email not confirmed")) {
          msg = "Indirizzo email non confermato. Controlla la tua casella di posta.";
      } else if (msgLower.includes("user not found")) {
          msg = "Utente non trovato. Registrati prima di accedere.";
      } else if (msgLower.includes("user already registered")) {
          msg = "Utente già registrato. Vai su ACCEDI.";
      } else if (msgLower.includes("rate limit")) {
          msg = "Troppi tentativi. Riprova tra poco.";
      }
      
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isFileProtocol) return;
    setLoading(true);
    setError(null);
    try {
        const { error } = await db.signInWithProvider('google');
        if (error) throw error;
    } catch (err: any) {
        console.error("Errore Login Google:", err);
        setError("Google ha bloccato il popup. Assicurati di non essere in modalità incognito o iframe.");
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-md w-full relative animate-in zoom-in-95 border border-white/50 flex flex-col">
        
        {/* Header Decorativo */}
        <div className="relative h-28 bg-gradient-to-r from-joy-400 to-orange-500 flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            <h3 className="text-2xl font-display font-bold text-white drop-shadow-md z-10">
                L'angolo del Buon Umore
            </h3>
            <div className="absolute top-4 right-4 z-20">
                <Tooltip content="Chiudi">
                    <button onClick={onClose} className="text-white/80 hover:text-white bg-black/10 hover:bg-black/20 rounded-full p-2 transition">
                        <IconX />
                    </button>
                </Tooltip>
            </div>
        </div>

        {/* TABS SWITCH */}
        <div className="flex border-b border-slate-100">
            <button 
                onClick={() => { setActiveTab('login'); setError(null); setSuccessMsg(null); }}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'login' ? 'text-joy-600 border-b-2 border-joy-500 bg-joy-50/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
                Accedi
            </button>
            <button 
                onClick={() => { setActiveTab('register'); setError(null); setSuccessMsg(null); }}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'register' ? 'text-joy-600 border-b-2 border-joy-500 bg-joy-50/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
                Registrati
            </button>
        </div>

        <div className="p-8">
            
            {/* Messaggi Feedback */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 flex items-start gap-2 animate-in slide-in-from-top-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                    <span>{error}</span>
                </div>
            )}
            {successMsg && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 text-xs rounded-lg border border-green-100 flex items-start gap-2 animate-in slide-in-from-top-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                    <span>{successMsg}</span>
                </div>
            )}

            {/* Social Login */}
            {!successMsg && (
                <div className="mb-6">
                    <button 
                        onClick={handleGoogleLogin}
                        disabled={isFileProtocol}
                        className={`w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-50 transition shadow-sm group ${isFileProtocol ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        Continua con Google
                    </button>
                    <div className="relative mt-6 mb-2">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                        <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest"><span className="bg-white px-2 text-slate-400">O usa la tua email</span></div>
                    </div>
                </div>
            )}

            {/* Email Form */}
            {!successMsg && (
                <form onSubmit={handleEmailAuth} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">Email</label>
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-joy-400 focus:border-joy-400 outline-none bg-slate-50 focus:bg-white transition"
                            placeholder="esempio@email.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">Password</label>
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                required
                                minLength={6}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-joy-400 focus:border-joy-400 outline-none bg-slate-50 focus:bg-white transition pr-10"
                                placeholder="••••••••"
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                )}
                            </button>
                        </div>
                        {activeTab === 'register' && (
                            <p className="text-[10px] text-slate-400 mt-1 ml-1">Minimo 6 caratteri</p>
                        )}
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition transform active:scale-[0.98] disabled:opacity-70 mt-2 shadow-lg shadow-slate-900/10"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <IconX className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> 
                                Elaborazione...
                            </span>
                        ) : (
                            activeTab === 'register' ? 'Crea Account' : 'Accedi'
                        )}
                    </button>
                </form>
            )}

        </div>
      </div>
    </div>
  );
};
