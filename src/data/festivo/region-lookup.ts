/* ============================================================
   Inferencia de la REGIÓN de una sede a partir de su municipio o
   provincia — usado como respaldo cuando la sede no tiene `region`
   cargada explícitamente (ver festivo.service.ts).

   La tabla está indexada por país porque "región" significa una cosa
   distinta en cada sitio: en España es la comunidad autónoma, en otro
   país sería el departamento o el estado. Colombia no aparece aquí a
   propósito: sus 18 festivos son nacionales (Ley 51/1983), no hay nada
   que inferir.

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
const ESPANA: Record<string, string> = {
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

/** Sin tildes y en minúsculas: "Málaga" y "Malaga" tienen que casar. */
export function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Tablas de inferencia por país. Un país que no esté aquí simplemente no
 * infiere región, que es lo correcto cuando no tiene festivos regionales.
 */
const POR_PAIS: Record<string, Record<string, string>> = {
  ES: ESPANA,
};

/**
 * Intenta resolver la región a partir del municipio (o, si no hay, de la
 * provincia legacy) de una sede. Devuelve `undefined` si no lo reconoce —
 * en ese caso FestivoService solo devuelve festivos NACIONAL, no asume
 * ninguna región por defecto.
 */
export function inferirRegion(
  pais: string,
  municipio?: string | null,
  provincia?: string | null,
): string | undefined {
  const tabla = POR_PAIS[pais?.toUpperCase()];
  if (!tabla) return undefined;
  for (const valor of [municipio, provincia]) {
    if (!valor) continue;
    const normalizado = normalizar(valor);
    if (tabla[normalizado]) return tabla[normalizado];
  }
  return undefined;
}
