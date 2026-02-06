/*
   OurCHat Logic
   Gère Supabase, l'authentification et le temps réel.
*/

// --- 1. CONFIGURATION SUPABASE ---
// REMPLACER CI-DESSOUS PAR LA CLE "ANON PUBLIC" QUI COMMENCE PAR "ey..."
// La clé fournie "sb_publishable_..." risque de ne pas marcher avec le client JS standard.
const SUPABASE_URL = 'https://olzvpkvtblpuqjvioiby.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_JbaOnCwQsEBKv408ONlHmw_W-rPVwbP';

// Initialisation (suppose que le script CDN est chargé dans le HTML)
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. GESTION DES REDIRECTIONS ---
const path = window.location.pathname;
const isAuthPage = path.includes('login.html') || path.includes('signup.html');

async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session && !isAuthPage) {
        // Pas connecté -> Hop, au login
        window.location.href = 'login.html';
    } else if (session && isAuthPage) {
        // Déjà connecté -> Hop, au chat
        window.location.href = 'index.html';
    }
    return session;
}

// Vérifier au chargement
checkUser();

// --- 3. FONCTIONS D'AUTH ---

// Inscription
async function handleSignup(email, password, username) {
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: { username: username } // On stocke le pseudo dans les métadonnées
        }
    });
    if (error) alert("Erreur: " + error.message);
    else alert("Inscription réussie ! Connectez-vous.");
}

// Connexion
async function handleLogin(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });
    if (error) alert("Erreur: " + error.message);
    else window.location.href = 'index.html';
}

// Déconnexion
async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}

// --- 4. LOGIQUE DU CHAT (Seulement sur index.html) ---
if (!isAuthPage) {
    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('msg-input');
    const sendBtn = document.getElementById('send-btn');
    let currentUser = null;

    // Charger l'utilisateur courant
    supabase.auth.getUser().then(res => {
        currentUser = res.data.user;
        loadMessages(); // Charger l'historique
        setupRealtime(); // Écouter les nouveaux messages
    });

    // Envoyer un message
    async function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;

        // On récupère le pseudo depuis les métadonnées de l'auth
        const username = currentUser.user_metadata.username || currentUser.email.split('@')[0];

        const { error } = await supabase
            .from('messages')
            .insert({ 
                content: text, 
                user_id: currentUser.id,
                username: username 
            });

        if (error) console.error('Erreur envoi:', error);
        else messageInput.value = ''; // Vider l'input
    }

    // Événements clic et entrée
    sendBtn?.addEventListener('click', sendMessage);
    messageInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

    // Afficher un message dans le DOM
    function displayMessage(msg) {
        const div = document.createElement('div');
        const isMine = msg.user_id === currentUser.id;
        
        div.className = `message ${isMine ? 'mine' : 'theirs'}`;
        
        // Convertir le timestamp
        const time = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        div.innerHTML = `
            <span class="meta">${isMine ? 'Moi' : msg.username} • ${time}</span>
            ${escapeHtml(msg.content)}
        `;
        
        chatContainer.appendChild(div);
        chatContainer.scrollTop = chatContainer.scrollHeight; // Scroll vers le bas
    }

    // Charger les anciens messages
    async function loadMessages() {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(50);
        
        if (error) console.error(error);
        else data.forEach(displayMessage);
    }

    // Écoute Temps Réel (La magie !)
    function setupRealtime() {
        supabase.channel('public:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                displayMessage(payload.new);
            })
            .subscribe();
    }

    // Sécurité XSS simple
    function escapeHtml(text) {
        if (!text) return text;
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// --- 5. LOGIQUE PAGES LOGIN/SIGNUP ---
if (path.includes('signup.html')) {
    document.getElementById('signup-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        const user = document.getElementById('username').value;
        handleSignup(email, pass, user);
    });
}

if (path.includes('login.html')) {
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        handleLogin(email, pass);
    });
}

