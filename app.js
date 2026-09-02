// App principale — nessun framework, nessun server.

const PROJECT_UNLOCK_KEY = 'tarkett_project_unlocked';

function projectSbloccato() {
  return sessionStorage.getItem(PROJECT_UNLOCK_KEY) === '1';
}
function sbloccaProject() {
  const pwd = prompt('Password per visualizzare i prezzi Project:');
  if (pwd === null) return;
  if (pwd === window.PROJECT_PASSWORD) {
    sessionStorage.setItem(PROJECT_UNLOCK_KEY, '1');
    aggiornaBottoneProject();
    render();
  } else {
    alert('Password errata.');
  }
}
function bloccaProject() {
  sessionStorage.removeItem(PROJECT_UNLOCK_KEY);
  aggiornaBottoneProject();
  render();
}
function aggiornaBottoneProject() {
  const btn = document.getElementById('btn-lock-project');
  if (!btn) return;
  btn.textContent = projectSbloccato() ? '🔓 Prezzi Project (blocca)' : '🔒 Prezzi Project';
  btn.onclick = projectSbloccato() ? bloccaProject : sbloccaProject;
}

let state = {
  view: 'nuovo', // 'nuovo' | 'archivio' | 'stampa'
  corrente: nuovoPreventivoVuoto(),
  stampaId: null,
};

function nuovoPreventivoVuoto() {
  const { id, numero, data } = prossimoIdPreventivo();
  return {
    _uid: generaUid(),
    id_preventivo: id,
    numero,
    data: data.toISOString(),
    oggetto: 'Preventivo',
    ragione_sociale: '',
    indirizzo: '',
    cap: '',
    citta: '',
    provincia: '',
    referente: '',
    email: '',
    cellulare: '',
    localita: '',
    cantiere: '',
    impresa: '',
    stato: 'Bozza',
    righe: [],
  };
}

const app = document.getElementById('app');

document.getElementById('tab-nuovo').onclick = () => { state.view = 'nuovo'; render(); };
document.getElementById('tab-archivio').onclick = () => { state.view = 'archivio'; render(); };
document.getElementById('tab-clienti').onclick = () => { state.view = 'clienti'; render(); };

function setTab(view) {
  document.getElementById('tab-nuovo').classList.toggle('active', view === 'nuovo');
  document.getElementById('tab-archivio').classList.toggle('active', view === 'archivio');
  document.getElementById('tab-clienti').classList.toggle('active', view === 'clienti');
}

function render() {
  if (state.view === 'stampa') {
    renderStampa();
    return;
  }
  setTab(state.view);
  if (state.view === 'nuovo') renderNuovo();
  else if (state.view === 'clienti') renderClienti();
  else renderArchivio();
}

// ---------------- VISTA: NUOVO PREVENTIVO ----------------

function renderNuovo() {
  const p = state.corrente;
  const totali = calcolaTotali(p.righe, window.CONFIG);
  const clienti = leggiClienti();

  app.innerHTML = `
    <div class="card">
      <div class="top-row">
        <div style="flex:1">
          <label>Cliente</label>
          <input list="lista-clienti" id="f-cliente" value="${escapeHtml(p.ragione_sociale)}" placeholder="Cerca cliente..." />
          <datalist id="lista-clienti">
            ${clienti.map(c => `<option value="${escapeHtml(c.ragione_sociale)}">`).join('')}
          </datalist>
        </div>
        <div style="flex:1">
          <label>Oggetto</label>
          <input id="f-oggetto" value="${escapeHtml(p.oggetto || 'Preventivo')}" placeholder="Oggetto del preventivo" />
        </div>
        <div style="text-align:right">
          <p class="muted" style="font-size:11px;color:#777">ID preventivo</p>
          <p style="font-weight:600">${p.id_preventivo}</p>
        </div>
      </div>
      <div id="f-cliente-dettagli" class="hint" style="margin-bottom:12px"></div>

      <div class="grid-3" style="margin-bottom:16px">
        <div><label>Impresa</label><input id="f-impresa" value="${escapeHtml(p.impresa)}" placeholder="Impresa esecutrice" /></div>
        <div><label>Località</label><input id="f-localita" value="${escapeHtml(p.localita)}" placeholder="Città/zona cantiere" /></div>
        <div><label>Cantiere</label><input id="f-cantiere" value="${escapeHtml(p.cantiere)}" placeholder="Riferimento cantiere" /></div>
      </div>

      <h2>Righe preventivo</h2>
      <div id="righe-container">
        ${p.righe.map((r, i) => rigaHtml(r, i)).join('') || '<p style="color:#999;font-size:13px;margin-bottom:8px">Nessuna riga inserita.</p>'}
      </div>
      <datalist id="lista-catalogo">
        ${leggiCatalogo().map(a => `<option value="${escapeHtml(a.selezione)}">`).join('')}
      </datalist>
      <button id="btn-aggiungi-riga">+ Aggiungi riga</button>

      <div class="totali" style="margin-top:20px">
        <div class="totali-box">
          <div class="row"><span>Totale imponibile</span><span>${euro(totali.totale_merce)}</span></div>
          <div class="row"><span>Extra trasporto</span><span>${euro(totali.trasporto)}</span></div>
          <div class="row"><span>IVA (${(window.CONFIG.AliquotaIVA * 100).toFixed(0)}%)</span><span>${euro(totali.iva)}</span></div>
          <div class="row tot"><span>Totale ivato</span><span>${euro(totali.totale_ivato)}</span></div>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
        <button id="btn-salva-bozza">Salva come bozza</button>
        <button id="btn-salva" class="primary">Salva preventivo</button>
      </div>
    </div>
  `;

  document.getElementById('f-cliente').onchange = e => {
    p.ragione_sociale = e.target.value;
    const c = clienti.find(c => c.ragione_sociale === e.target.value);
    if (c) {
      p.indirizzo = c.indirizzo || '';
      p.cap = c.cap || '';
      p.citta = c.citta || '';
      p.provincia = c.provincia || '';
      p.referente = c.referente || '';
      p.email = c.email || '';
      p.cellulare = c.cellulare || '';
    }
    renderClienteDettagli();
  };
  document.getElementById('f-oggetto').onchange = e => p.oggetto = e.target.value;
  document.getElementById('f-impresa').onchange = e => p.impresa = e.target.value;
  document.getElementById('f-localita').onchange = e => p.localita = e.target.value;
  document.getElementById('f-cantiere').onchange = e => p.cantiere = e.target.value;

  function renderClienteDettagli() {
    const box = document.getElementById('f-cliente-dettagli');
    if (!p.ragione_sociale) { box.textContent = ''; return; }
    const parti = [p.indirizzo, [p.cap, p.citta, p.provincia].filter(Boolean).join(' '), p.email, p.cellulare].filter(Boolean);
    box.textContent = parti.length ? parti.join(' · ') : 'Cliente non in anagrafica — verrà usato solo il nome digitato.';
  }
  renderClienteDettagli();

  document.getElementById('btn-aggiungi-riga').onclick = () => {
    p.righe.push(rigaVuota());
    render();
  };

  document.getElementById('btn-salva-bozza').onclick = () => salvaCorrente('Bozza');
  document.getElementById('btn-salva').onclick = () => salvaCorrente('Salvato');

  p.righe.forEach((r, i) => bindRigaEvents(r, i));
}

function rigaVuota() {
  return {
    codice_articolo: '', sconto_1: 0.5, sconto_2: 0.25,
    variante_riservato: 'sc2', prezzo_manuale: 0, quantita_richiesta: 0,
  };
}

function rigaHtml(r, i) {
  const articolo = leggiCatalogo().find(a => a.codice_articolo === r.codice_articolo);
  const bloccato = !projectSbloccato();
  let calcolo = null;
  if (articolo) {
    calcolo = calcolaRiga({
      articolo, sconto1: Number(r.sconto_1), sconto2: Number(r.sconto_2),
      variante: r.variante_riservato, prezzoManuale: r.prezzo_manuale,
      quantitaRichiesta: r.quantita_richiesta,
    });
  }
  const scontiOptions = window.CONFIG.SconteDisponibili.map(s =>
    `<option value="${s}">${(s * 100).toFixed(0)}%</option>`).join('');

  return `
  <div class="riga" data-idx="${i}">
    <div class="riga-grid">
      <div>
        <label>Articolo</label>
        <input list="lista-catalogo" class="r-articolo" value="${articolo ? escapeHtml(articolo.selezione) : ''}" placeholder="Cerca articolo..." />
        ${articolo ? `<p class="hint">${escapeHtml(articolo.dimensioni || '')} · multiplo ${articolo.multiplo}</p>` : ''}
      </div>
      <div>
        <label>Prezzo listino</label>
        <p style="padding-top:6px">${articolo ? euro(articolo.prezzo_listino) : '—'}</p>
        <p class="hint">${articolo ? (bloccato ? '🔒 Project bloccato' : 'Project ' + euro(articolo.prezzo_project)) : ''}</p>
      </div>
      <div>
        <label>Sc.1</label>
        <select class="r-sconto1">${scontiOptions}</select>
        <label style="margin-top:6px">Sc.2</label>
        <select class="r-sconto2">${scontiOptions}</select>
      </div>
      <div class="riservato-opzioni">
        <label><input type="radio" name="riservato-${i}" class="r-variante" value="sc2" ${r.variante_riservato === 'sc2' ? 'checked' : ''}> Sc.2 ${calcolo ? '— ' + euro(calcolo.prezzo_dopo_sconto2) : ''}</label>
        <label style="${bloccato ? 'opacity:0.5' : ''}"><input type="radio" name="riservato-${i}" class="r-variante" value="project" ${r.variante_riservato === 'project' ? 'checked' : ''} ${bloccato ? 'disabled title="Inserisci la password per usare il prezzo Project"' : ''}> Project ${bloccato ? '🔒' : (calcolo ? '— ' + euro(calcolo.prezzo_project) : '')}</label>
        <label><input type="radio" name="riservato-${i}" class="r-variante" value="manuale" ${r.variante_riservato === 'manuale' ? 'checked' : ''}> Manuale</label>
        ${r.variante_riservato === 'manuale' ? `<input type="number" class="r-manuale" value="${r.prezzo_manuale}" step="0.01" style="margin-top:4px" />` : ''}
      </div>
      <div>
        <label>Q.tà</label>
        <input type="number" class="r-quantita" value="${r.quantita_richiesta}" step="1" />
        ${calcolo ? `<p class="hint">arrot. ${calcolo.quantita_arrotondata}</p>` : ''}
      </div>
      <div style="text-align:right">
        <label>Totale</label>
        <p style="font-weight:600;padding-top:6px">${calcolo ? euro(calcolo.totale) : '—'}</p>
        ${calcolo ? `<p class="hint">suppl. ${euro(calcolo.supplemento_unitario)}/mq</p>` : ''}
      </div>
      <div style="padding-top:18px">
        <button class="r-rimuovi danger" title="Rimuovi riga">✕</button>
      </div>
    </div>
  </div>`;
}

function bindRigaEvents(r, i) {
  const el = document.querySelector(`.riga[data-idx="${i}"]`);
  if (!el) return;

  el.querySelector('.r-articolo').onchange = e => {
    const art = leggiCatalogo().find(a => a.selezione === e.target.value);
    r.codice_articolo = art ? art.codice_articolo : '';
    render();
  };
  el.querySelector('.r-sconto1').value = r.sconto_1;
  el.querySelector('.r-sconto1').onchange = e => { r.sconto_1 = Number(e.target.value); render(); };
  el.querySelector('.r-sconto2').value = r.sconto_2;
  el.querySelector('.r-sconto2').onchange = e => { r.sconto_2 = Number(e.target.value); render(); };

  el.querySelectorAll('.r-variante').forEach(radio => {
    radio.onchange = e => { r.variante_riservato = e.target.value; render(); };
  });
  const manualeInput = el.querySelector('.r-manuale');
  if (manualeInput) manualeInput.onchange = e => { r.prezzo_manuale = Number(e.target.value); render(); };

  el.querySelector('.r-quantita').onchange = e => { r.quantita_richiesta = Number(e.target.value); render(); };
  el.querySelector('.r-rimuovi').onclick = () => {
    state.corrente.righe.splice(i, 1);
    render();
  };
}

function salvaCorrente(stato) {
  const p = state.corrente;
  if (!p.ragione_sociale) { alert('Seleziona un cliente prima di salvare.'); return; }
  const righeCalcolate = p.righe.map(r => {
    const articolo = leggiCatalogo().find(a => a.codice_articolo === r.codice_articolo);
    if (!articolo) return null;
    const calcolo = calcolaRiga({
      articolo, sconto1: Number(r.sconto_1), sconto2: Number(r.sconto_2),
      variante: r.variante_riservato, prezzoManuale: r.prezzo_manuale,
      quantitaRichiesta: r.quantita_richiesta,
    });
    return { ...r, descrizione: articolo.descrizione, dimensioni: articolo.dimensioni, sito_url: articolo.sito_url, ...calcolo };
  }).filter(Boolean);

  const totali = calcolaTotali(righeCalcolate, window.CONFIG);
  const daSalvare = { ...p, righe: righeCalcolate, stato, ...totali, aggiornato_il: new Date().toISOString() };
  salvaPreventivo(daSalvare);
  state.corrente = nuovoPreventivoVuoto();
  state.view = 'archivio';
  render();
}

// ---------------- VISTA: ARCHIVIO ----------------

function renderArchivio() {
  const lista = leggiArchivio();
  app.innerHTML = `
    <div class="card">
      <div class="top-row">
        <input type="text" id="f-cerca" placeholder="Cerca per cliente o ID preventivo" />
        <button id="btn-nuovo" class="primary">+ Nuovo preventivo</button>
      </div>
      <table class="lista">
        <thead><tr>
          <th>ID preventivo</th><th>Data</th><th>Cliente</th><th>Stato</th><th style="text-align:right">Totale ivato</th><th></th>
        </tr></thead>
        <tbody id="righe-archivio"></tbody>
      </table>
      ${lista.length === 0 ? '<p style="color:#999;font-size:13px;margin-top:12px">Nessun preventivo salvato.</p>' : ''}
    </div>
  `;

  function disegnaLista(filtro) {
    const f = (filtro || '').toLowerCase();
    const filtrata = lista.filter(p =>
      !f || p.ragione_sociale.toLowerCase().includes(f) || p.id_preventivo.toLowerCase().includes(f));
    document.getElementById('righe-archivio').innerHTML = filtrata.map(p => `
      <tr>
        <td>${p.id_preventivo}</td>
        <td>${new Date(p.data).toLocaleDateString('it-IT')}</td>
        <td>${escapeHtml(p.ragione_sociale)}</td>
        <td><span class="badge ${p.stato === 'Salvato' ? 'salvato' : 'bozza'}">${p.stato}</span></td>
        <td style="text-align:right">${euro(p.totale_ivato)}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn-apri" data-id="${p.id_preventivo}">Apri</button>
          <button class="btn-stampa" data-id="${p.id_preventivo}">Stampa</button>
          <button class="btn-elimina danger" data-id="${p.id_preventivo}">Elimina</button>
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('.btn-apri').forEach(b => b.onclick = () => {
      state.corrente = lista.find(p => p.id_preventivo === b.dataset.id);
      state.view = 'nuovo';
      render();
    });
    document.querySelectorAll('.btn-stampa').forEach(b => b.onclick = () => {
      state.stampaId = b.dataset.id;
      state.view = 'stampa';
      render();
    });
    document.querySelectorAll('.btn-elimina').forEach(b => b.onclick = () => {
      if (confirm('Eliminare questo preventivo?')) { eliminaPreventivo(b.dataset.id); renderArchivio(); }
    });
  }

  disegnaLista('');
  document.getElementById('f-cerca').oninput = e => disegnaLista(e.target.value);
  document.getElementById('btn-nuovo').onclick = () => { state.corrente = nuovoPreventivoVuoto(); state.view = 'nuovo'; render(); };
}

// ---------------- VISTA: CLIENTI ----------------

function renderClienti() {
  const clienti = leggiClienti();
  app.innerHTML = `
    <div class="card">
      <h2>Nuovo cliente</h2>
      <div class="grid-3" style="margin-bottom:10px">
        <div><label>Ragione sociale</label><input id="c-nome" placeholder="Ragione sociale" /></div>
        <div><label>Indirizzo</label><input id="c-indirizzo" /></div>
        <div><label>CAP</label><input id="c-cap" /></div>
      </div>
      <div class="grid-3" style="margin-bottom:10px">
        <div><label>Città</label><input id="c-citta" /></div>
        <div><label>Provincia</label><input id="c-provincia" maxlength="2" /></div>
        <div><label>Cellulare</label><input id="c-cellulare" /></div>
      </div>
      <div class="grid-3" style="margin-bottom:10px">
        <div><label>E-mail</label><input id="c-email" /></div>
        <div><label>E-mail 2</label><input id="c-email2" /></div>
        <div><label>Alla cortese att.ne del Sig.</label><input id="c-referente" /></div>
      </div>
      <div class="grid-2" style="margin-bottom:14px">
        <div><label>Modalità pagamento concordata</label><input id="c-pagamento" /></div>
        <div><label>Sconto</label><input id="c-sconto" /></div>
      </div>
      <button class="primary" id="btn-add-cliente">Aggiungi / aggiorna cliente</button>
    </div>

    <div class="card">
      <div class="top-row">
        <input type="text" id="f-cerca-cliente" placeholder="Cerca per ragione sociale o città" />
        <span class="muted" style="font-size:12px;color:#777">${clienti.length} clienti</span>
      </div>
      <table class="lista">
        <thead><tr><th>Ragione sociale</th><th>Città</th><th>E-mail</th><th>Cellulare</th><th></th></tr></thead>
        <tbody id="righe-clienti"></tbody>
      </table>
    </div>
  `;

  function disegnaLista(filtro) {
    const f = (filtro || '').toLowerCase();
    const filtrata = clienti.filter(c =>
      !f || c.ragione_sociale.toLowerCase().includes(f) || (c.citta || '').toLowerCase().includes(f));
    document.getElementById('righe-clienti').innerHTML = filtrata.map(c => `
      <tr>
        <td>${escapeHtml(c.ragione_sociale)}</td>
        <td>${escapeHtml(c.citta || '')}</td>
        <td>${escapeHtml(c.email || '')}</td>
        <td>${escapeHtml(c.cellulare || '')}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn-modifica-cliente" data-nome="${escapeHtml(c.ragione_sociale)}">Modifica</button>
          <button class="btn-elimina-cliente danger" data-nome="${escapeHtml(c.ragione_sociale)}">Elimina</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="color:#999">Nessun cliente trovato.</td></tr>';

    document.querySelectorAll('.btn-modifica-cliente').forEach(b => b.onclick = () => {
      const c = clienti.find(x => x.ragione_sociale === b.dataset.nome);
      if (!c) return;
      document.getElementById('c-nome').value = c.ragione_sociale || '';
      document.getElementById('c-indirizzo').value = c.indirizzo || '';
      document.getElementById('c-cap').value = c.cap || '';
      document.getElementById('c-citta').value = c.citta || '';
      document.getElementById('c-provincia').value = c.provincia || '';
      document.getElementById('c-cellulare').value = c.cellulare || '';
      document.getElementById('c-email').value = c.email || '';
      document.getElementById('c-email2').value = c.email_2 || '';
      document.getElementById('c-referente').value = c.referente || '';
      document.getElementById('c-pagamento').value = c.modalita_pagamento || '';
      document.getElementById('c-sconto').value = c.sconto || '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.querySelectorAll('.btn-elimina-cliente').forEach(b => b.onclick = () => {
      if (confirm('Eliminare questo cliente dall\'anagrafica?')) { eliminaCliente(b.dataset.nome); renderClienti(); }
    });
  }

  disegnaLista('');
  document.getElementById('f-cerca-cliente').oninput = e => disegnaLista(e.target.value);

  document.getElementById('btn-add-cliente').onclick = () => {
    const nome = document.getElementById('c-nome').value.trim();
    if (!nome) { alert('Inserisci almeno la ragione sociale.'); return; }
    salvaCliente({
      ragione_sociale: nome,
      indirizzo: document.getElementById('c-indirizzo').value.trim(),
      cap: document.getElementById('c-cap').value.trim(),
      citta: document.getElementById('c-citta').value.trim(),
      provincia: document.getElementById('c-provincia').value.trim(),
      cellulare: document.getElementById('c-cellulare').value.trim(),
      email: document.getElementById('c-email').value.trim(),
      email_2: document.getElementById('c-email2').value.trim(),
      referente: document.getElementById('c-referente').value.trim(),
      modalita_pagamento: document.getElementById('c-pagamento').value.trim(),
      sconto: document.getElementById('c-sconto').value.trim(),
    });
    renderClienti();
  };
}

// ---------------- VISTA: STAMPA ----------------

function renderStampa() {
  const p = leggiArchivio().find(x => x.id_preventivo === state.stampaId) || state.corrente;
  const agente = window.AGENTE || { nome: '', indirizzo: '', cap_citta: '', telefono: '' };
  app.innerHTML = `
    <div class="no-print" style="max-width:700px;margin:16px auto;display:flex;justify-content:space-between">
      <button id="btn-indietro">← Torna all'archivio</button>
      <button id="btn-stampa-ora" class="primary">Stampa / Salva PDF</button>
    </div>
    <div class="stampa-sheet">
      <div class="stampa-header">
        <div>
          <p style="font-weight:600">${escapeHtml(agente.nome)}</p>
          <p style="font-size:12px;color:#777">${escapeHtml(agente.indirizzo)}<br/>${escapeHtml(agente.cap_citta)}<br/>${escapeHtml(agente.telefono)}</p>
        </div>
        <div style="text-align:right">
          <p style="font-size:18px;font-weight:700;letter-spacing:0.5px">PREVENTIVO</p>
          <p style="font-size:12px;color:#777">N. ${p.numero} · Del ${new Date(p.data).toLocaleDateString('it-IT')}</p>
        </div>
      </div>

      <div class="stampa-info">
        <div><p class="muted">Oggetto</p><p>${escapeHtml(p.oggetto || 'Preventivo')}</p></div>
        <div><p class="muted">Impresa</p><p>${escapeHtml(p.impresa || '-')}</p></div>
        <div><p class="muted">ID preventivo</p><p>${p.id_preventivo}</p></div>
        <div><p class="muted">Località</p><p>${escapeHtml(p.localita || '-')}</p></div>
        <div><p class="muted">Cantiere</p><p>${escapeHtml(p.cantiere || '-')}</p></div>
        <div><p class="muted">Data</p><p>${new Date(p.data).toLocaleDateString('it-IT')}</p></div>
      </div>
      <div class="stampa-info">
        <div style="grid-column:span 2">
          <p class="muted">Spett.le</p>
          <p style="font-weight:600">${escapeHtml(p.ragione_sociale)}</p>
          <p>${escapeHtml(p.indirizzo || '')}</p>
          <p>${escapeHtml(p.cap || '')} ${escapeHtml(p.citta || '')} ${escapeHtml(p.provincia || '')}</p>
          ${p.referente ? `<p>Alla cortese att.ne del Sig. ${escapeHtml(p.referente)}</p>` : ''}
        </div>
        <div>
          <p class="muted">E-mail</p><p>${escapeHtml(p.email || '-')}</p>
          ${p.cellulare ? `<p class="muted" style="margin-top:6px">Cellulare</p><p>${escapeHtml(p.cellulare)}</p>` : ''}
        </div>
      </div>

      <table>
        <thead><tr>
          <th>Cod. articolo</th><th>Descrizione</th><th>Dimensioni</th><th>Sito</th>
          <th style="text-align:right">Q.tà richiesta</th><th style="text-align:right">Q.tà multiplo</th>
          <th style="text-align:right">Riservato €/mq</th><th style="text-align:right">Supp. €/mq *</th><th style="text-align:right">Totale</th>
        </tr></thead>
        <tbody>
          ${p.righe.map(r => `
            <tr>
              <td>${escapeHtml(r.codice_articolo)}</td>
              <td>${escapeHtml(r.descrizione || '')}</td>
              <td>${escapeHtml(r.dimensioni || '')}</td>
              <td>${r.sito_url ? `<a href="${escapeHtml(r.sito_url)}">link</a>` : ''}</td>
              <td style="text-align:right">${r.quantita_richiesta}</td>
              <td style="text-align:right">${r.quantita_arrotondata}</td>
              <td style="text-align:right">${euro(r.prezzo_riservato)}</td>
              <td style="text-align:right">${euro(r.supplemento_unitario)}</td>
              <td style="text-align:right">${euro(r.totale)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totali" style="margin-top:16px">
        <div class="totali-box">
          <div class="row"><span>Totale Imponibile</span><span>${euro(p.totale_merce)}</span></div>
          <div class="row"><span>Incremento costo trasporto sotto i ${euro(window.CONFIG.SogliaTrasporto)}</span><span>${euro(p.trasporto)}</span></div>
          <div class="row"><span>Imposta IVA</span><span>${euro(p.iva)}</span></div>
          <div class="row tot"><span>TOTALE IVATO</span><span>${euro(p.totale_ivato)}</span></div>
        </div>
      </div>
      <p style="font-size:10px;color:#999;margin-top:10px">* Supplemento per aumenti materie prime (3,50%) e maggiorazione per consegna (3,50%)</p>
    </div>
  `;
  document.getElementById('btn-indietro').onclick = () => { state.view = 'archivio'; render(); };
  document.getElementById('btn-stampa-ora').onclick = () => window.print();
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

render();
