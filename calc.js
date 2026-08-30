// Logica di calcolo — identica a quella validata nel backend (calc.js)

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function ceilingToMultiplo(quantita, multiplo) {
  if (!multiplo || multiplo <= 0) return quantita;
  return Math.ceil(quantita / multiplo) * multiplo;
}

function calcolaRiga({ articolo, sconto1, sconto2, variante, prezzoManuale, quantitaRichiesta }) {
  const prezzoListino = Number(articolo.prezzo_listino) || 0;
  const prezzoDopoSconto1 = prezzoListino * (1 - sconto1);
  const prezzoDopoSconto2 = prezzoDopoSconto1 * (1 - sconto2);
  const prezzoProject = Number(articolo.prezzo_project) || 0;

  let prezzoRiservato;
  if (variante === 'sc2') prezzoRiservato = prezzoDopoSconto2;
  else if (variante === 'project') prezzoRiservato = prezzoProject;
  else prezzoRiservato = Number(prezzoManuale) || 0;

  const supplementoUnitario = prezzoRiservato * 0.07;
  const quantitaArrotondata = ceilingToMultiplo(Number(quantitaRichiesta) || 0, Number(articolo.multiplo) || 1);
  const totale = (prezzoRiservato + supplementoUnitario) * quantitaArrotondata;

  return {
    prezzo_listino: round2(prezzoListino),
    prezzo_dopo_sconto1: round2(prezzoDopoSconto1),
    prezzo_dopo_sconto2: round2(prezzoDopoSconto2),
    prezzo_project: round2(prezzoProject),
    variante_riservato: variante,
    prezzo_riservato: round2(prezzoRiservato),
    supplemento_unitario: round2(supplementoUnitario),
    quantita_richiesta: Number(quantitaRichiesta) || 0,
    quantita_arrotondata: round2(quantitaArrotondata),
    totale: round2(totale),
  };
}

function calcolaTotali(righe, configurazione) {
  const totaleMerce = righe.reduce((acc, r) => acc + r.totale, 0);
  const { AliquotaIVA, SogliaTrasporto, CostoSottoSoglia } = configurazione;
  const extraTrasporto = totaleMerce > SogliaTrasporto ? 0 : CostoSottoSoglia;
  const iva = (totaleMerce + extraTrasporto) * AliquotaIVA;
  const totaleIvato = totaleMerce + extraTrasporto + iva;
  return {
    totale_merce: round2(totaleMerce),
    trasporto: round2(extraTrasporto),
    iva: round2(iva),
    totale_ivato: round2(totaleIvato),
  };
}

function generaIdPreventivo(data, numeroProgressivo) {
  const yyyy = data.getFullYear();
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const dd = String(data.getDate()).padStart(2, '0');
  const num = String(numeroProgressivo).padStart(3, '0');
  return `PRV-${yyyy}${mm}${dd}-${num}`;
}

function euro(n) {
  return (n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
