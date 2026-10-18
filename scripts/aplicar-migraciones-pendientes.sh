#!/usr/bin/env bash
# ============================================================================
# Aplica a PRODUCCION las migraciones que Prisma no puede aplicar solo.
#
# Por que a mano: el historial de produccion esta divergido (hay filas en
# _prisma_migrations sin carpeta en el repo), asi que `prisma migrate deploy`
# se niega a seguir. Esto hace lo mismo que haria el: ejecuta el SQL y apunta
# la fila en el registro, cada migracion dentro de UNA transaccion.
#
#   Ver que pasaria (no toca nada):   bash scripts/aplicar-migraciones-pendientes.sh
#   Aplicar de verdad:                APLICAR=si bash scripts/aplicar-migraciones-pendientes.sh
#
# Se puede volver a ejecutar: lo que ya este aplicado se salta.
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
RAIZ="$PWD"

PENDIENTES=(
  20261008120000_kyc_numero_documento
  20261008130000_stock_e_insumos
  20261008140000_insumo_objetivo
)

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
gris()  { printf '\033[90m%s\033[0m\n' "$*"; }

command -v psql >/dev/null || { rojo "Falta psql. Instalalo con: sudo apt install postgresql-client"; exit 1; }

# ---- La URL sale del .env del repo. No se imprime nunca. -------------------
# Si ya viene una por el entorno se respeta (sirve para ensayar contra la
# base de desarrollo); si no, se coge la del .env del repo.
if [ -n "${DATABASE_URL:-}" ]; then
  ORIGEN_URL="la variable DATABASE_URL del entorno"
else
  [ -f .env ] || { rojo "No encuentro .env en $RAIZ"; exit 1; }
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
  ORIGEN_URL="el fichero .env del repo"
fi
[ -n "$DATABASE_URL" ] || { rojo "No hay DATABASE_URL ni en el entorno ni en .env"; exit 1; }

# Prisma mete en la URL parametros que psql no entiende (schema,
# connection_limit, pgbouncer...). psql corta con «parametro de URI no
# valido», asi que se quedan solo los que libpq conoce. El schema, si no
# es public, se pasa aparte por PGOPTIONS.
ESQUEMA="$(printf '%s' "$DATABASE_URL" | sed -nE 's/.*[?&]schema=([^&]+).*/\1/p')"
BASE_URL="${DATABASE_URL%%\?*}"
CONSULTA="${DATABASE_URL#"$BASE_URL"}"; CONSULTA="${CONSULTA#\?}"
CONSERVADOS=""
if [ -n "$CONSULTA" ]; then
  IFS='&' read -ra _PARES <<< "$CONSULTA"
  for _p in "${_PARES[@]}"; do
    case "${_p%%=*}" in
      sslmode|sslrootcert|sslcert|sslkey|connect_timeout|application_name|options|target_session_attrs)
        CONSERVADOS="${CONSERVADOS:+$CONSERVADOS&}$_p" ;;
    esac
  done
fi
DATABASE_URL="$BASE_URL${CONSERVADOS:+?$CONSERVADOS}"
if [ -n "$ESQUEMA" ] && [ "$ESQUEMA" != "public" ]; then
  export PGOPTIONS="--search_path=$ESQUEMA"
fi
export DATABASE_URL

# Host y base, con la contrasena tapada.
DESTINO="$(printf '%s' "$DATABASE_URL" | sed -E 's#^([a-z]+)://[^:]+:[^@]+@#\1://***:***@#')"

echo
echo "============================================================"
echo " Migraciones pendientes -> BASE DE DATOS"
echo "============================================================"
echo "  destino: $DESTINO"
echo "  (sale de $ORIGEN_URL)"
psql "$DATABASE_URL" -qtA -c "SELECT '  servidor: ' || current_setting('server_version') || '   base: ' || current_database();" \
  || { rojo "No puedo conectar. Revisa la URL o la red."; exit 1; }
echo

# ---- El registro de Prisma tiene que ser el de siempre ---------------------
COLS="$(psql "$DATABASE_URL" -qtA -c "
  SELECT string_agg(column_name, ',' ORDER BY column_name)
  FROM information_schema.columns WHERE table_name = '_prisma_migrations';")"
ESPERADAS="applied_steps_count,checksum,finished_at,id,logs,migration_name,rolled_back_at,started_at"
if [ "$COLS" != "$ESPERADAS" ]; then
  rojo "El registro _prisma_migrations no tiene las columnas que espero."
  echo "  encontradas: ${COLS:-ninguna (la tabla no existe)}"
  echo "  esperadas:   $ESPERADAS"
  exit 1
fi

# ---- Estado actual ---------------------------------------------------------
echo "Estado de cada una:"
A_APLICAR=()
for m in "${PENDIENTES[@]}"; do
  SQL="prisma/migrations/$m/migration.sql"
  [ -f "$SQL" ] || { rojo "  FALTA el fichero $SQL"; exit 1; }
  YA="$(psql "$DATABASE_URL" -qtA -c "SELECT count(*) FROM \"_prisma_migrations\" WHERE migration_name = '$m' AND rolled_back_at IS NULL;")"
  if [ "$YA" -gt 0 ]; then
    verde "  [ya aplicada]  $m"
  else
    echo   "  [pendiente]    $m"
    A_APLICAR+=("$m")
  fi
done
echo

# ---- Aviso si los objetos ya existen sin estar apuntados -------------------
HUERFANOS="$(psql "$DATABASE_URL" -qtA -c "
  SELECT string_agg(t, ', ') FROM (
    SELECT 'tabla ' || tablename AS t FROM pg_tables
     WHERE schemaname='public' AND tablename IN ('insumos','stock_sede','solicitudes_inventario','solicitud_items')
    UNION ALL
    SELECT 'columna empresa_kyc.documento_numero' FROM information_schema.columns
     WHERE table_name='empresa_kyc' AND column_name='documento_numero'
    UNION ALL
    SELECT 'columna insumos.max_por_defecto' FROM information_schema.columns
     WHERE table_name='insumos' AND column_name='max_por_defecto'
  ) s;")"
if [ -n "$HUERFANOS" ] && [ ${#A_APLICAR[@]} -gt 0 ]; then
  rojo "AVISO: estos objetos YA existen en la base:"
  echo "  $HUERFANOS"
  echo "  Si alguna de las migraciones pendientes los crea, fallara y se deshara sola."
  echo
fi

if [ ${#A_APLICAR[@]} -eq 0 ]; then
  verde "No hay nada que aplicar. La base esta al dia."
  exit 0
fi

if [ "${APLICAR:-}" != "si" ]; then
  echo "------------------------------------------------------------"
  echo "Esto ha sido un ENSAYO: no se ha tocado nada."
  echo "Para aplicarlas de verdad:"
  echo
  echo "  APLICAR=si bash scripts/aplicar-migraciones-pendientes.sh"
  echo "------------------------------------------------------------"
  exit 0
fi

# ---- Aplicar ---------------------------------------------------------------
echo "Aplicando ${#A_APLICAR[@]} migracion(es). Cada una en su transaccion."
echo
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for m in "${A_APLICAR[@]}"; do
  SQL="prisma/migrations/$m/migration.sql"
  SUMA="$(sha256sum "$SQL" | cut -d' ' -f1)"
  COMBINADO="$TMP/$m.sql"

  cat "$SQL" > "$COMBINADO"
  cat >> "$COMBINADO" <<EOF

-- Apunta la migracion en el registro de Prisma, dentro de la misma
-- transaccion: o entran las dos cosas, o no entra ninguna.
INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES
  (md5(random()::text || clock_timestamp()::text)::uuid::text,
   '$SUMA', now(), '$m', NULL, NULL, now(), 1);
EOF

  printf '  %-42s ' "$m"
  if psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 --single-transaction -f "$COMBINADO" >"$TMP/$m.log" 2>&1; then
    verde "OK"
  else
    rojo "FALLO (nada de esta migracion se ha aplicado)"
    echo
    gris "  --- lo que dijo postgres ---"
    sed 's/^/  /' "$TMP/$m.log"
    echo
    rojo "Me paro aqui. Las anteriores si quedaron aplicadas."
    exit 1
  fi
done

# ---- Comprobacion final ----------------------------------------------------
echo
echo "Comprobando..."
psql "$DATABASE_URL" -q -c "
  SELECT migration_name AS migracion,
         to_char(finished_at, 'YYYY-MM-DD HH24:MI') AS aplicada
    FROM \"_prisma_migrations\"
   WHERE migration_name IN ('20261008120000_kyc_numero_documento',
                            '20261008130000_stock_e_insumos',
                            '20261008140000_insumo_objetivo')
   ORDER BY migration_name;"

psql "$DATABASE_URL" -q -c "
  SELECT 'tablas de stock creadas' AS que, count(*) AS cuantas
    FROM pg_tables WHERE schemaname='public'
     AND tablename IN ('insumos','stock_sede','solicitudes_inventario','solicitud_items')
  UNION ALL
  SELECT 'columnas nuevas', count(*) FROM information_schema.columns
   WHERE (table_name='empresa_kyc' AND column_name='documento_numero')
      OR (table_name='insumos'     AND column_name='max_por_defecto');"

echo
verde "Listo. Esperado: 4 tablas y 2 columnas."
echo "Ahora ya se puede desplegar el backend."
