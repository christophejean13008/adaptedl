/* =====================================================================
   Adaptedl — relais Albert (Cloudflare Worker)

   Albert API refuse les appels venus d'un navigateur. Ce relais les
   transmet depuis un serveur : la clé y est posée une seule fois, et
   l'iPad n'a plus rien à connaître.

   INSTALLATION (une fois, une dizaine de minutes)
   1. dash.cloudflare.com → Workers & Pages → Create → Worker → Deploy
   2. « Edit code », coller ce fichier en entier, Deploy
   3. Settings → Variables and Secrets → Add → Secret
        Nom   : CLE_ALBERT
        Valeur: ta clé Albert
   4. ORIGINES est déjà réglé sur https://christophejean13008.github.io :
      rien à changer, sauf si tu changes de compte GitHub
   5. Copier l'adresse du worker (https://xxx.workers.dev) et la coller
      dans Adaptedl : fournisseur « Relais », champ adresse.
   ===================================================================== */

const ALBERT = 'https://albert.api.etalab.gouv.fr/v1/chat/completions';

// Seules ces origines peuvent utiliser le relais : sans cela, n'importe qui
// pourrait consommer ton quota d'agent de l'État.
const ORIGINES = ['https://christophejean13008.github.io'];

export default {
  async fetch(requete, env) {
    const origine = requete.headers.get('Origin') || '';
    const autorisee = ORIGINES.includes(origine);
    const entetes = {
      'Access-Control-Allow-Origin': autorisee ? origine : 'null',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin'
    };

    if (requete.method === 'OPTIONS') return new Response(null, { status: 204, headers: entetes });
    if (!autorisee) return new Response(JSON.stringify({ error: 'origine non autorisée : ' + origine }),
      { status: 403, headers: { ...entetes, 'Content-Type': 'application/json' } });
    if (requete.method !== 'POST') return new Response('POST attendu', { status: 405, headers: entetes });
    if (!env.CLE_ALBERT) return new Response(JSON.stringify({ error: 'secret CLE_ALBERT absent du worker' }),
      { status: 500, headers: { ...entetes, 'Content-Type': 'application/json' } });

    const corps = await requete.text();
    if (corps.length > 12e6) return new Response(JSON.stringify({ error: 'image trop lourde' }),
      { status: 413, headers: { ...entetes, 'Content-Type': 'application/json' } });

    let reponse;
    try {
      reponse = await fetch(ALBERT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.CLE_ALBERT },
        body: corps
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Albert injoignable depuis le relais' }),
        { status: 502, headers: { ...entetes, 'Content-Type': 'application/json' } });
    }
    const texte = await reponse.text();
    return new Response(texte, { status: reponse.status, headers: { ...entetes, 'Content-Type': 'application/json' } });
  }
};
