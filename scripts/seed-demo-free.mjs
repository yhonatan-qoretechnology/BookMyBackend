/* ============================================================
   Cuenta de demostracion de Bookmy Free.

   Crea (o completa, si ya existe) una empresa con sus dos sedes, horarios,
   servicios, empleados, clientes, reservas repartidas por los ultimos tres
   meses, cobros, resenas y vistas del catalogo. Todo por el API real, con
   la sesion de un SUPER_ADMIN, asi que sirve a la vez de prueba de humo de
   los modulos que ensena Bookmy Free: reservas, clientes, empleados,
   servicios, calendario, resenas y sedes.

   Uso:
     API_URL=http://localhost:5000 \
     SEED_ADMIN_EMAIL=superadmin@bookmy.com SEED_ADMIN_PASS='...' \
     node scripts/seed-demo-free.mjs

   Es idempotente: lo que ya existe no se duplica. Para que el historico
   quede realista (createdAt de citas y pagos en su fecha, y vistas
   repartidas en el tiempo) se pasa despues scripts/seed-demo-free.sql.
============================================================ */

const BASE = (process.env.API_URL || 'http://localhost:5000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'superadmin@bookmy.com';
const ADMIN_PASS = process.env.SEED_ADMIN_PASS || 'SuperAdmin123$';

const EMPRESA = process.env.SEED_EMPRESA || 'Bookmy Free Demo';
const DEMO_LOGIN = process.env.SEED_DEMO_EMAIL || 'demo@bookmy.es';
const DEMO_PASS = process.env.SEED_DEMO_PASS || 'DemoBookmy1!';
const DOMINIO_CLIENTES = process.env.SEED_CLIENTES_DOMINIO || 'bookmydemo.es';
/* Los telefonos son unicos en toda la plataforma: para sembrar una segunda
   cuenta demo (o repetir sobre datos existentes) hay que cambiar el prefijo. */
const TEL = process.env.SEED_TEL_PREFIJO || '+346001';

let token = null;
const fallos = [];
const log = (...a) => console.log(...a);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body, { reintentos = 4 } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const texto = await res.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = texto; }
  /* /auth limita a 5-20 peticiones por minuto: se espera y se repite en vez
     de dejar clientes a medias. */
  if (res.status === 429 && reintentos > 0) {
    await espera(30000);
    return api(method, path, body, { reintentos: reintentos - 1 });
  }
  return { ok: res.ok, status: res.status, datos };
}
const apuntar = (que, r) => {
  if (!r.ok) fallos.push(`${que}: ${r.status} ${JSON.stringify(r.datos).slice(0, 120)}`);
  return r;
};
const lista = (d) => (Array.isArray(d) ? d : d?.items || d?.data || d?.clients || []);

/* ── tiempo en Europe/Madrid ─────────────────────────────── */
function desfaseMadrid(fecha) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(fecha).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - fecha.getTime();
}
/** Hora de pared de Madrid -> instante UTC */
function madrid(y, m, d, hh, mm) {
  const g = new Date(Date.UTC(y, m - 1, d, hh, mm));
  return new Date(g.getTime() - desfaseMadrid(g));
}
const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d);
const diaSemana = (d) =>
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    .indexOf(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', weekday: 'short' }).format(d));

/* Aleatorio reproducible: dos pasadas dan el mismo reparto. */
let semilla = 20260925;
const rnd = () => ((semilla = (semilla * 1664525 + 1013904223) % 4294967296) / 4294967296);
const elegir = (arr) => arr[Math.floor(rnd() * arr.length)];

/* ── catalogo de la demo ─────────────────────────────────── */
const SEDES = [
  { nombre: 'Demo Centro', direccion: 'Calle Larios 5, Malaga', telefono: `${TEL}00210`,
    pais: 'Espana', municipio: 'Malaga', provincia: 'Malaga', localidad: 'Centro',
    latitud: 36.7196, longitud: -4.42 },
  { nombre: 'Demo Playa', direccion: 'Avenida Antonio Machado 20, Benalmadena', telefono: `${TEL}00211`,
    pais: 'Espana', municipio: 'Benalmadena', provincia: 'Malaga', localidad: 'Arroyo de la Miel',
    latitud: 36.5987, longitud: -4.5166 },
];
const SERVICIOS = [
  { es: 'Corte de pelo', en: 'Haircut', cat: 'peluquer', precio: 18, min: 30 },
  { es: 'Color y mechas', en: 'Color and highlights', cat: 'peluquer', precio: 55, min: 90 },
  { es: 'Manicura semipermanente', en: 'Gel manicure', cat: 'manicura', precio: 25, min: 45 },
  { es: 'Pedicura spa', en: 'Spa pedicure', cat: 'pedicura', precio: 30, min: 50 },
  { es: 'Tratamiento facial', en: 'Facial treatment', cat: 'faciales', precio: 40, min: 60 },
  { es: 'Masaje relajante', en: 'Relaxing massage', cat: 'masajes', precio: 45, min: 60 },
];
const EMPLEADOS = [
  { nombre: 'Lucia Fernandez', phone: `${TEL}00301`, sede: 0, bio: 'Estilista y colorista.' },
  { nombre: 'Marco Ruiz', phone: `${TEL}00302`, sede: 0, bio: 'Barbero y tecnico de corte.' },
  { nombre: 'Paula Gomez', phone: `${TEL}00303`, sede: 1, bio: 'Especialista en unas.' },
  { nombre: 'Ivan Torres', phone: `${TEL}00304`, sede: 1, bio: 'Masajista y esteticista.' },
];
const CLIENTES = [
  ['Ana Molina', 'ana.molina'], ['Carlos Vidal', 'carlos.vidal'], ['Marta Reyes', 'marta.reyes'],
  ['Jorge Pena', 'jorge.pena'], ['Nuria Lopez', 'nuria.lopez'], ['Sergio Blanco', 'sergio.blanco'],
  ['Elena Soto', 'elena.soto'], ['David Ortiz', 'david.ortiz'], ['Clara Nunez', 'clara.nunez'],
  ['Pablo Marin', 'pablo.marin'], ['Rocio Diaz', 'rocio.diaz'], ['Hugo Serrano', 'hugo.serrano'],
];
const COMENTARIOS = [
  'Muy buen trato y puntualidad.', 'Me encanto el resultado, repetire.',
  'Buen servicio, aunque tuve que esperar un poco.', 'Profesionales y local muy limpio.',
  'El mejor sitio de la zona.', 'Correcto, sin mas.', 'Salgo encantada cada vez.',
  'Atencion excelente desde que entras.',
];

async function main() {
  log('login como administrador…');
  const acceso = await api('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  token = acceso.datos?.token || acceso.datos?.access_token;
  if (!token) throw new Error('no se pudo iniciar sesion: ' + JSON.stringify(acceso.datos).slice(0, 200));

  /* ── empresa ── */
  const empresas = lista((await api('GET', '/empresas')).datos);
  let empresa = empresas.find((e) => e.nombre === EMPRESA);
  if (!empresa) {
    empresa = apuntar('crear empresa', await api('POST', '/empresas', {
      nombre: EMPRESA, telefono: `${TEL}00200`, email: `hola@${DOMINIO_CLIENTES}`, nit: 'B00000000',
      descripcion: 'Cuenta de demostracion de Bookmy Free',
      descripcionLarga: 'Centro de belleza y bienestar para ensenar Bookmy Free: reservas, clientes, empleados, servicios, calendario, resenas y sedes.',
    })).datos;
  }
  log('empresa', empresa.id, empresa.nombre);

  /* ── usuario de prueba (dueno del negocio) ── */
  const admins = lista((await api('GET', '/admin/admins')).datos);
  if (!admins.some((a) => (a.email || a.user?.email) === DEMO_LOGIN)) {
    apuntar('crear usuario de prueba', await api('POST', `/admin/companies/${empresa.id}/admins`, {
      email: DEMO_LOGIN, password: DEMO_PASS, phone: `${TEL}00201`,
      firstName: 'Demo', lastName: 'Bookmy', name: 'Demo Bookmy', countryId: 1,
    }));
  }
  log('usuario de prueba', DEMO_LOGIN);

  /* ── sedes y horarios ── */
  const existentes = lista((await api('GET', `/sedes/empresa/${empresa.id}`)).datos);
  const sedes = [];
  for (const def of SEDES) {
    let s = existentes.find((x) => x.nombre === def.nombre);
    if (!s) s = apuntar('crear sede ' + def.nombre, await api('POST', '/sedes', { ...def, empresaId: empresa.id })).datos;
    if (s?.id) sedes.push(s);
  }
  for (const s of sedes) {
    const hay = lista((await api('GET', `/horario-sede?sedeId=${s.id}`)).datos);
    for (let dia = 1; dia <= 6; dia++) {
      if (hay.some((h) => h.diaSemana === dia)) continue;
      apuntar(`horario sede ${s.id} dia ${dia}`, await api('POST', '/horario-sede', {
        sedeId: s.id, diaSemana: dia,
        horaApertura: dia === 6 ? '10:00' : '09:00',
        horaCierre: dia === 6 ? '14:00' : '20:00',
        activo: true,
      }));
    }
  }
  log('sedes', sedes.map((s) => `${s.id}:${s.nombre}`).join(', '), '(lunes a sabado)');

  /* ── servicios ── */
  const categorias = lista((await api('GET', '/categories')).datos);
  const nombreCat = (c) => (c.translations || []).find((t) => t.language === 'es')?.name || '';
  const catPorNombre = (frag) =>
    categorias.find((c) => nombreCat(c).toLowerCase().includes(frag))?.id || categorias[0]?.id;
  /* Se miran TODOS los servicios de la empresa y no /services/by-sede, que
     solo devuelve los que ya tienen a alguien asignado: si no, una segunda
     pasada intentaria crearlos otra vez y chocaria con el nombre repetido. */
  const idsSedes = new Set(sedes.map((s) => s.id));
  const yaServicios = lista((await api('GET', '/services?language=es')).datos)
    .filter((sv) => (sv.sedes || []).some((x) => idsSedes.has(x.id)));
  const servicios = [];
  for (const def of SERVICIOS) {
    let sv = yaServicios.find(
      (x) => x.name === def.es || (x.translations || []).some((t) => t.name === def.es),
    );
    if (!sv) {
      sv = apuntar('crear servicio ' + def.es, await api('POST', '/services', {
        categoryId: catPorNombre(def.cat),
        translations: [
          { language: 'es', name: def.es, description: `${def.es} en ${EMPRESA}` },
          { language: 'en', name: def.en, description: `${def.en} at ${EMPRESA}` },
        ],
        prices: [{ amount: def.precio, duration: def.min, currency: 'EUR' }],
        sedeIds: sedes.map((s) => s.id),
      })).datos;
    }
    if (sv?.id) servicios.push({ ...sv, precio: def.precio, min: def.min, nombre: def.es });
  }
  log('servicios', servicios.length);

  /* ── empleados y que servicios presta cada uno ── */
  const profes = [];
  for (const def of EMPLEADOS) {
    const sede = sedes[def.sede];
    const enSede = lista((await api('GET', `/profesionales/by-sede/${sede.id}`)).datos);
    let p = enSede.find((x) => x.nombre === def.nombre);
    if (!p) {
      const r = apuntar('crear empleado ' + def.nombre, await api('POST', '/profesionales', {
        nombre: def.nombre, biografia: def.bio, phone: def.phone, sedeId: sede.id, password: DEMO_PASS,
      }));
      p = r.datos?.profesional || r.datos;
    }
    if (p?.id) profes.push({ ...p, sedeId: sede.id });
  }
  for (const p of profes) {
    for (const sv of servicios) {
      const r = await api('POST', '/service-sede-profesional', { sedeId: p.sedeId, serviceId: sv.id, profesionalId: p.id });
      if (!r.ok && r.status !== 409 && !/exist|duplic/i.test(JSON.stringify(r.datos))) {
        fallos.push(`asignar servicio ${sv.id} a ${p.id}: ${r.status}`);
      }
    }
  }
  log('empleados', profes.length);

  /* ── clientes ── */
  const clientes = [];
  for (let i = 0; i < CLIENTES.length; i++) {
    const [nombre, usuario] = CLIENTES[i];
    const email = `${usuario}@${DOMINIO_CLIENTES}`;
    const buscado = await api('POST', '/clients/search', { email });
    let c = buscado.ok && buscado.datos?.id ? buscado.datos : null;
    if (!c) {
      const r = apuntar('crear cliente ' + email, await api('POST', '/auth/register', {
        name: nombre, phone: `${TEL}004${String(i).padStart(2, '0')}`, email, password: DEMO_PASS,
        gender: i % 2 ? 'male' : 'female', idioma: 'es', countryId: 1,
        acceptTerms: true, acceptPolitics: true, clientType: 'people', state: 'enabled',
      }));
      c = r.datos?.user || r.datos;
      await espera(1500); // el registro esta limitado por minuto
    }
    if (c?.id) clientes.push({ id: c.id, nombre, email });
  }
  log('clientes', clientes.length);

  /* ── reservas: tres meses hacia atras y dos semanas hacia delante ──
     Si la cuenta ya tiene agenda no se vuelve a sembrar: una segunda pasada
     duplicaria el historico en vez de completarlo. */
  const yaHayAgenda = (
    await Promise.all(sedes.map((s) => api('GET', `/appointments/filter?sedeId=${s.id}&limit=1`)))
  ).some((r) => lista(r.datos).length > 0);
  if (yaHayAgenda) {
    log('la cuenta ya tiene reservas: no se siembran de nuevo');
    log('\n== resumen ==');
    log('empresa', empresa.id, '| sedes', sedes.map((s) => s.id).join(','),
        '| servicios', servicios.length, '| empleados', profes.length, '| clientes', clientes.length);
    log('usuario de prueba:', DEMO_LOGIN, '/', DEMO_PASS);
    if (fallos.length) log('fallos:', fallos.length);
    return;
  }

  const hoy = new Date();
  const ocupado = new Map();
  const creadas = [];
  const HORAS = [9, 10, 11, 12, 13, 16, 17, 18, 19];
  for (let delta = -90; delta <= 14; delta++) {
    const dia = new Date(hoy.getTime() + delta * 86400000);
    const dow = diaSemana(dia);
    if (dow === 0) continue;
    const [Y, M, D] = ymd(dia).split('-').map(Number);
    const cuantas = delta > 0 ? (rnd() < 0.5 ? 1 : 2) : (rnd() < 0.35 ? 1 : rnd() < 0.8 ? 2 : 3);
    for (let k = 0; k < cuantas; k++) {
      const p = elegir(profes);
      const sv = elegir(servicios);
      const cli = elegir(clientes);
      if (!p || !sv || !cli) continue;
      const h = elegir(dow === 6 ? [10, 11, 12] : HORAS);
      const ini = madrid(Y, M, D, h, 0);
      const fin = new Date(ini.getTime() + sv.min * 60000);
      if (fin > madrid(Y, M, D, dow === 6 ? 14 : 20, 0)) continue;
      const ocupa = ocupado.get(p.id) || [];
      if (ocupa.some((o) => ini < o.fin && fin > o.ini)) continue;

      const estado = delta > 0
        ? (rnd() < 0.6 ? 'CONFIRMED' : 'PENDING')
        : (() => { const r = rnd(); return r < 0.84 ? 'COMPLETED' : r < 0.92 ? 'CANCELLED' : 'NO_SHOW'; })();
      const metodo = rnd() < 0.55 ? 'CARD' : 'CASH';
      const r = await api('POST', '/appointments', {
        fecha: ini.toISOString(), horaInicio: ini.toISOString(), horaFin: fin.toISOString(),
        duracion: sv.min, estado, sedeId: p.sedeId, serviceId: sv.id, profesionalId: p.id, userId: cli.id,
        paymentMethod: metodo, paymentAmount: sv.precio,
        ...(metodo === 'CARD' ? { cardNumber: '4111111111111111', expiryDate: '12/30', cvv: '123' } : {}),
      });
      if (!r.ok) { fallos.push(`cita ${ymd(dia)}: ${JSON.stringify(r.datos).slice(0, 100)}`); continue; }
      ocupa.push({ ini, fin }); ocupado.set(p.id, ocupa);
      creadas.push({ id: r.datos?.appointment?.id ?? r.datos?.id, estado, servicio: sv, cliente: cli, sedeId: p.sedeId });
    }
  }
  log('reservas creadas', creadas.length);

  /* ── cobrar en efectivo lo ya atendido (las de tarjeta las cobra el simulador) ── */
  let cobrados = 0;
  for (const s of sedes) {
    for (const pago of lista((await api('GET', `/payments/filter?sedeId=${s.id}`)).datos)) {
      if (pago.status !== 'RESERVED') continue;
      if ((pago.appointment?.estado ?? pago.appointment?.status) !== 'COMPLETED') continue;
      if (apuntar('cobrar pago ' + pago.id, await api('PATCH', `/payments/${pago.id}/confirm`, {})).ok) cobrados++;
    }
  }
  log('pagos cobrados', cobrados);

  /* ── resenas: la mayoria aprobadas, unas pocas pendientes de moderar ── */
  const completadas = creadas.filter((c) => c.estado === 'COMPLETED');
  const vistas = new Set();
  let resenas = 0, pendientes = 0;
  for (let i = 0; i < completadas.length && resenas < 22; i += 3) {
    const c = completadas[i];
    const clave = `${c.cliente.id}-${c.sedeId}-${c.servicio.id}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    const nota = rnd() < 0.7 ? 5 : rnd() < 0.7 ? 4 : 3;
    const r = apuntar('crear resena', await api('POST', '/resenas', {
      calificacion: nota, comentario: elegir(COMENTARIOS), estado: 'PENDIENTE', tipo: 'SERVICIO',
      sedeId: c.sedeId, serviceId: c.servicio.id, usuarioId: c.cliente.id,
    }));
    if (!r.ok) continue;
    resenas++;
    if (resenas % 6 === 0) { pendientes++; continue; }   // se quedan sin aprobar a proposito
    apuntar('aprobar resena', await api('PATCH', `/resenas/${r.datos.id}/aprobar`, { aprobado: true }));
  }
  log('resenas', resenas, `(${pendientes} pendientes de moderar)`);

  /* ── vistas del catalogo: lo que registra la app movil ── */
  let vistasOk = 0;
  const ciudades = ['Malaga', 'Benalmadena', 'Torremolinos', 'Fuengirola', 'Marbella'];
  for (const p of profes) {
    const r = await api('POST', '/entity-views', {
      entityType: 'PROFESIONAL', entityId: p.id, empresaId: empresa.id, sedeId: p.sedeId, city: elegir(ciudades),
    });
    if (r.ok) vistasOk++;
  }
  const r = await api('POST', '/entity-views', { entityType: 'EMPRESA', entityId: empresa.id, empresaId: empresa.id, city: 'Malaga' });
  if (r.ok) vistasOk++;
  log('vistas registradas', vistasOk, '(el backend deduplica por usuario y ficha cada 30 min)');

  log('\n== resumen ==');
  log('empresa', empresa.id, '| sedes', sedes.map((s) => s.id).join(','), '| servicios', servicios.length,
      '| empleados', profes.length, '| clientes', clientes.length,
      '| reservas', creadas.length, '| resenas', resenas);
  log('usuario de prueba:', DEMO_LOGIN, '/', DEMO_PASS);
  if (fallos.length) {
    const agrupados = new Map();
    for (const f of fallos) {
      const k = f.replace(/\d+/g, '#').slice(0, 90);
      agrupados.set(k, (agrupados.get(k) || 0) + 1);
    }
    log('\nfallos (' + fallos.length + '):');
    for (const [k, n] of agrupados) log('  x' + n, k);
  }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
