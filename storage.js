// Archivio preventivi, clienti e catalogo salvati nel browser (localStorage), niente server.

const STORAGE_KEY = 'preventivatore_tarkett_archivio';
const CLIENTI_KEY = 'preventivatore_tarkett_clienti';
const CATALOGO_KEY = 'preventivatore_tarkett_catalogo';
const CATALOGO_VERSION_KEY = 'preventivatore_tarkett_catalogo_versione';
const PROJECT_PIN_KEY = 'preventivatore_tarkett_project_pin';
const PROJECT_UNLOCK_KEY = 'preventivatore_tarkett_project_sbloccato';

function generaUid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// Chiave di identità di un preventivo: preferisce _uid (univoco anche tra
// dispositivi diversi); ripiega su id_preventivo per i preventivi salvati
// prima che esistesse _uid.
function chiavePreventivo(p) {
  return p._uid || p.id_preventivo;
}

function leggiArchivio() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function scriviArchivio(lista) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

function salvaPreventivo(preventivo) {
  const lista = leggiArchivio();
  const idx = lista.findIndex(p => chiavePreventivo(p) === chiavePreventivo(preventivo));
  if (idx >= 0) lista[idx] = preventivo;
  else lista.unshift(preventivo);
  scriviArchivio(lista);
}

function eliminaPreventivo(id) {
  scriviArchivio(leggiArchivio().filter(p => p.id_preventivo !== id));
}

function prossimoIdPreventivo() {
  const oggi = new Date();
  const prefix = generaIdPreventivo(oggi, 0).slice(0, -3);
  const lista = leggiArchivio();
  const numeroOggi = lista.filter(p => p.id_preventivo.startsWith(prefix)).length + 1;
  return { id: generaIdPreventivo(oggi, numeroOggi), numero: String(numeroOggi).padStart(3, '0'), data: oggi };
}

// ---------------- CLIENTI (modificabili) ----------------
// Al primo avvio la lista clienti modificabile viene inizializzata dai dati
// precaricati in data.js (window.CLIENTI); da quel momento in poi la fonte
// di verità è quella salvata qui, così le modifiche fatte nell'app persistono.

function leggiClienti() {
  try {
    const salvati = JSON.parse(localStorage.getItem(CLIENTI_KEY));
    if (salvati) return salvati;
  } catch (e) { /* ignora e ripiega sul default */ }
  const iniziali = (window.CLIENTI || []).slice();
  scriviClienti(iniziali);
  return iniziali;
}

function scriviClienti(lista) {
  localStorage.setItem(CLIENTI_KEY, JSON.stringify(lista));
}

function salvaCliente(cliente) {
  const lista = leggiClienti();
  const idx = lista.findIndex(c => c.ragione_sociale === cliente.ragione_sociale);
  if (idx >= 0) lista[idx] = cliente;
  else lista.push(cliente);
  scriviClienti(lista);
}

function eliminaCliente(ragioneSociale) {
  scriviClienti(leggiClienti().filter(c => c.ragione_sociale !== ragioneSociale));
}

// ---------------- CATALOGO (modificabile) ----------------

function leggiCatalogo() {
  const versioneInclusa = window.CATALOGO_VERSION || '';
  const versioneSalvata = localStorage.getItem(CATALOGO_VERSION_KEY) || '';

  // Quando l'app contiene un listino più recente, sostituisce soltanto il
  // catalogo locale. Clienti e preventivi salvati restano invariati.
  if (versioneInclusa && versioneSalvata !== versioneInclusa) {
    const aggiornato = (window.CATALOGO || []).slice();
    scriviCatalogo(aggiornato);
    localStorage.setItem(CATALOGO_VERSION_KEY, versioneInclusa);
    return aggiornato;
  }

  try {
    const salvato = JSON.parse(localStorage.getItem(CATALOGO_KEY));
    if (salvato) return salvato;
  } catch (e) { /* ignora e ripiega sul default */ }
  const iniziale = (window.CATALOGO || []).slice();
  scriviCatalogo(iniziale);
  return iniziale;
}

function scriviCatalogo(lista) {
  localStorage.setItem(CATALOGO_KEY, JSON.stringify(lista));
}

function separatoreCatalogo(testo) {
  const primaRiga = testo.split(/\r\n|\n|\r/, 1)[0] || '';
  const puntiVirgola = (primaRiga.match(/;/g) || []).length;
  const virgole = (primaRiga.match(/,/g) || []).length;
  return puntiVirgola >= virgole ? ';' : ',';
}

function parseCsvCatalogo(testo, separatore) {
  const righe = [];
  let riga = [], campo = '', traVirgolette = false;

  for (let i = 0; i < testo.length; i++) {
    const ch = testo[i];
    if (traVirgolette) {
      if (ch === '"' && testo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') {
        traVirgolette = false;
      } else {
        campo += ch;
      }
    } else if (ch === '"') {
      traVirgolette = true;
    } else if (ch === separatore) {
      riga.push(campo);
      campo = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && testo[i + 1] === '\n') i++;
      riga.push(campo);
      if (riga.some(v => v.trim() !== '')) righe.push(riga);
      riga = [];
      campo = '';
    } else {
      campo += ch;
    }
  }
  riga.push(campo);
  if (riga.some(v => v.trim() !== '')) righe.push(riga);
  return righe;
}

function numeroCatalogo(valore) {
  const testo = String(valore || '').trim();
  if (!testo) return '';
  const normalizzato = testo.includes(',')
    ? testo.replace(/\./g, '').replace(',', '.')
    : testo;
  const numero = Number(normalizzato);
  return Number.isFinite(numero) ? numero : testo;
}

async function importaCatalogoCSV(file) {
  const bytes = await file.arrayBuffer();
  let testo;
  try {
    testo = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (e) {
    testo = new TextDecoder('windows-1252').decode(bytes);
  }
  testo = testo.replace(/^\uFEFF/, '');

  const righe = parseCsvCatalogo(testo, separatoreCatalogo(testo));
  if (!righe.length) throw new Error('Il file è vuoto.');

  const intestazioni = righe.shift().map(v => v.trim());
  const richieste = [
    'CodiceArticolo', 'Descrizione', 'Dimensioni', 'Multiplo',
    'PrezzoListino', 'PrezzoProject', 'Prezzo50_10', 'Prezzo50_20',
    'Prezzo50_25', 'PGC', 'BC', 'Sito', 'Selezione'
  ];
  if (richieste.some((nome, i) => intestazioni[i] !== nome)) {
    throw new Error('Le colonne non corrispondono al foglio Catalogo.');
  }

  const catalogo = righe
    .filter(r => String(r[0] || '').trim())
    .map(r => {
      while (r.length < 13) r.push('');
      return {
        codice_articolo: String(r[0]).trim(),
        descrizione: r[1],
        dimensioni: r[2],
        multiplo: numeroCatalogo(r[3]),
        prezzo_listino: numeroCatalogo(r[4]),
        prezzo_project: numeroCatalogo(r[5]),
        prezzo_50_10: numeroCatalogo(r[6]),
        prezzo_50_20: numeroCatalogo(r[7]),
        prezzo_50_25: numeroCatalogo(r[8]),
        pgc: String(r[9] || '').trim(),
        bc: String(r[10] || '').trim(),
        sito_url: String(r[11] || '').trim(),
        selezione: r[12] || `${String(r[0]).trim()} - ${r[1]}`
      };
    });

  if (!catalogo.length) throw new Error('Nessun articolo trovato.');
  scriviCatalogo(catalogo);
  localStorage.setItem(
    CATALOGO_VERSION_KEY,
    window.CATALOGO_VERSION || `importato-${Date.now()}`
  );
  return { articoli: catalogo.length };
}

function salvaArticolo(articolo) {
  const lista = leggiCatalogo();
  const idx = lista.findIndex(a => a.codice_articolo === articolo.codice_articolo);
  if (idx >= 0) lista[idx] = articolo; else lista.push(articolo);
  scriviCatalogo(lista);
}

function eliminaArticolo(codice) {
  scriviCatalogo(leggiCatalogo().filter(a => a.codice_articolo !== codice));
}

// ---------------- PROTEZIONE PREZZI PROJECT ----------------

function pinProjectConfigurato() {
  return Boolean(localStorage.getItem(PROJECT_PIN_KEY));
}

function projectSbloccato() {
  return sessionStorage.getItem(PROJECT_UNLOCK_KEY) === '1';
}

function impostaPinProject() {
  const primo = prompt('Imposta un PIN per proteggere i prezzi Project:');
  if (primo === null) return false;
  if (primo.trim().length < 4) {
    alert('Il PIN deve contenere almeno 4 caratteri.');
    return false;
  }
  const conferma = prompt('Ripeti il PIN Project:');
  if (conferma !== primo) {
    alert('I PIN non coincidono.');
    return false;
  }
  localStorage.setItem(PROJECT_PIN_KEY, primo);
  sessionStorage.setItem(PROJECT_UNLOCK_KEY, '1');
  return true;
}

function sbloccaProject() {
  if (!pinProjectConfigurato()) return impostaPinProject();
  const pin = prompt('Inserisci il PIN per visualizzare e usare i prezzi Project:');
  if (pin === null) return false;
  if (pin !== localStorage.getItem(PROJECT_PIN_KEY)) {
    alert('PIN Project non corretto.');
    return false;
  }
  sessionStorage.setItem(PROJECT_UNLOCK_KEY, '1');
  return true;
}

function bloccaProject() {
  sessionStorage.removeItem(PROJECT_UNLOCK_KEY);
}

function cambiaPinProject() {
  if (pinProjectConfigurato() && !sbloccaProject()) return false;
  localStorage.removeItem(PROJECT_PIN_KEY);
  bloccaProject();
  return impostaPinProject();
}

// ---------------- BACKUP: esporta / importa tutto l'archivio ----------------

function esportaBackup() {
  const dati = {
    versione: 1,
    esportato_il: new Date().toISOString(),
    archivio: leggiArchivio(),
    clienti: leggiClienti(),
    catalogo: leggiCatalogo(),
  };
  const blob = new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tarkett-preventivi-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importaBackup(file) {
  let dati;
  try {
    dati = JSON.parse(await file.text());
  } catch (e) {
    alert('Il file scelto non è un backup valido (JSON non leggibile).');
    return false;
  }
  if (!dati || typeof dati !== 'object' || (!dati.archivio && !dati.clienti && !dati.catalogo)) {
    alert('Il file non sembra un backup di questa applicazione.');
    return false;
  }
  if (!confirm('Importare questo backup? Verrà unito ai dati già presenti su questo dispositivo (nessun preventivo, cliente o articolo verrà cancellato).')) {
    return false;
  }

  let aggiunti = 0, aggiornati = 0;

  // Archivio: unione per identità (_uid, o id_preventivo per i più vecchi).
  // In caso di conflitto vince la versione con la modifica più recente.
  if (Array.isArray(dati.archivio)) {
    const locale = leggiArchivio();
    const mappa = new Map(locale.map(p => [chiavePreventivo(p), p]));
    dati.archivio.forEach(importato => {
      const key = chiavePreventivo(importato);
      const esistente = mappa.get(key);
      if (!esistente) {
        mappa.set(key, importato);
        aggiunti++;
      } else {
        const tImportato = Date.parse(importato.aggiornato_il || 0) || 0;
        const tEsistente = Date.parse(esistente.aggiornato_il || 0) || 0;
        if (tImportato > tEsistente) { mappa.set(key, importato); aggiornati++; }
      }
    });
    scriviArchivio(Array.from(mappa.values()));
  }

  // Clienti e catalogo: unione additiva per chiave naturale; il backup
  // importato aggiorna i campi solo per le voci in conflitto, non elimina
  // mai voci presenti solo in locale.
  if (Array.isArray(dati.clienti)) {
    const locale = leggiClienti();
    const mappa = new Map(locale.map(c => [c.ragione_sociale, c]));
    dati.clienti.forEach(c => mappa.set(c.ragione_sociale, { ...(mappa.get(c.ragione_sociale) || {}), ...c }));
    scriviClienti(Array.from(mappa.values()));
  }
  if (Array.isArray(dati.catalogo)) {
    const locale = leggiCatalogo();
    const mappa = new Map(locale.map(a => [a.codice_articolo, a]));
    dati.catalogo.forEach(a => mappa.set(a.codice_articolo, { ...(mappa.get(a.codice_articolo) || {}), ...a }));
    scriviCatalogo(Array.from(mappa.values()));
  }

  return { aggiunti, aggiornati };
}
