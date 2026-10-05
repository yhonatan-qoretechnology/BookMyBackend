/* ============================================================
   Inferencia de comunidad autónoma (CCAA) a partir del municipio o
   provincia guardados en `Sede` — usado como respaldo cuando la sede no
   tiene `ccaa` cargado explícitamente (ver festivo.service.ts).

   `Sede.provincia` en este proyecto guarda casi siempre un nombre de
   MUNICIPIO (ver comentario en schema.prisma), no de provincia formal —
   así que esta tabla cubre ambos: las 50 provincias + Ceuta/Melilla, y
   las ciudades/municipios más comunes (capitales de provincia y las que
   ya aparecen en datos reales del proyecto: Benalmádena, Fuengirola,
   Marbella, Bilbao, Ibiza...). No pretende ser exhaustiva — si aparece
   un municipio que no está acá, agregarlo es tan simple como sumar una
   línea.
============================================================ */

// Códigos ISO 3166-2:ES de las 17 comunidades autónomas + Ceuta y Melilla.
const MUNICIPIO_O_PROVINCIA_A_CCAA: Record<string, string> = {
  // Andalucía (AN)
  almeria: 'AN', cadiz: 'AN', cordoba: 'AN', granada: 'AN', huelva: 'AN',
  jaen: 'AN', malaga: 'AN', sevilla: 'AN',
  benalmadena: 'AN', fuengirola: 'AN', marbella: 'AN', torremolinos: 'AN',
  mijas: 'AN', estepona: 'AN', jerez: 'AN', 'jerez de la frontera': 'AN',
  algeciras: 'AN', 'roquetas de mar': 'AN',

  // Aragón (AR)
  huesca: 'AR', teruel: 'AR', zaragoza: 'AR',

  // Asturias (AS)
  asturias: 'AS', oviedo: 'AS', gijon: 'AS', aviles: 'AS',

  // Cantabria (CB)
  cantabria: 'CB', santander: 'CB',

  // Castilla-La Mancha (CM)
  albacete: 'CM', 'ciudad real': 'CM', cuenca: 'CM', guadalajara: 'CM', toledo: 'CM',

  // Castilla y León (CL)
  avila: 'CL', burgos: 'CL', leon: 'CL', palencia: 'CL', salamanca: 'CL',
  segovia: 'CL', soria: 'CL', valladolid: 'CL', zamora: 'CL',

  // Cataluña (CT)
  barcelona: 'CT', girona: 'CT', lleida: 'CT', tarragona: 'CT',
  hospitalet: 'CT', 'hospitalet de llobregat': 'CT', badalona: 'CT',
  terrassa: 'CT', sabadell: 'CT',

  // Comunitat Valenciana (VC)
  alicante: 'VC', castellon: 'VC', valencia: 'VC', elche: 'VC',
  torrevieja: 'VC', benidorm: 'VC', gandia: 'VC',

  // Extremadura (EX)
  badajoz: 'EX', caceres: 'EX',

  // Galicia (GA)
  coruna: 'GA', 'a coruna': 'GA', lugo: 'GA', ourense: 'GA', pontevedra: 'GA', vigo: 'GA',

  // Illes Balears (IB)
  baleares: 'IB', illesbalears: 'IB', 'illes balears': 'IB',
  ibiza: 'IB', eivissa: 'IB', mallorca: 'IB', palma: 'IB',
  'palma de mallorca': 'IB', menorca: 'IB', mahon: 'IB', mao: 'IB',

  // Canarias (CN)
  'las palmas': 'CN', 'santa cruz de tenerife': 'CN', tenerife: 'CN',
  'gran canaria': 'CN',

  // La Rioja (RI)
  larioja: 'RI', 'la rioja': 'RI', logrono: 'RI',

  // Madrid (MD)
  madrid: 'MD', 'alcala de henares': 'MD', mostoles: 'MD', getafe: 'MD',
  fuenlabrada: 'MD', leganes: 'MD', alcorcon: 'MD',

  // Murcia (MC)
  murcia: 'MC', cartagena: 'MC',

  // Navarra (NC)
  navarra: 'NC', pamplona: 'NC',

  // País Vasco (PV)
  alava: 'PV', araba: 'PV', gipuzkoa: 'PV', guipuzcoa: 'PV', bizkaia: 'PV',
  vizcaya: 'PV', bilbao: 'PV', 'san sebastian': 'PV', donostia: 'PV',
  'vitoria-gasteiz': 'PV', vitoria: 'PV',

  // Ciudades autónomas
  ceuta: 'CE',
  melilla: 'ML',
};

function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Intenta resolver la CCAA a partir del municipio (o, si no hay, de la
 * provincia legacy) de una sede. Devuelve `undefined` si no lo reconoce —
 * en ese caso FestivoService solo va a devolver festivos NACIONAL, no
 * asume ninguna comunidad por defecto.
 */
export function inferirCcaa(
  municipio?: string | null,
  provincia?: string | null,
): string | undefined {
  for (const valor of [municipio, provincia]) {
    if (!valor) continue;
    const normalizado = normalizar(valor);
    if (MUNICIPIO_O_PROVINCIA_A_CCAA[normalizado]) {
      return MUNICIPIO_O_PROVINCIA_A_CCAA[normalizado];
    }
  }
  return undefined;
}
