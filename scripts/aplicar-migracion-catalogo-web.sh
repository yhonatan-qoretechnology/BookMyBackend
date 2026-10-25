#!/usr/bin/env bash
# ============================================================================
# Aplica a PRODUCCION la migracion del catalogo web: las columnas nuevas de
# "insumos" (20261025120000_insumo_catalogo_web).
#
# Va ANTES de desplegar el backend que la usa: Prisma pide todas las columnas
# del modelo en cada consulta, y el codigo nuevo contra una tabla sin ellas
# romperia todo el modulo de stock. Al reves no pasa nada: el backend de ahora
# no mira las columnas nuevas.
#
# Por que a mano: el historial de produccion esta divergido y
# `prisma migrate deploy` se niega a seguir (ver aplicar-migraciones-pendientes.sh).
# Esto hace lo mismo que haria el: ejecuta el SQL y apunta la fila en
# _prisma_migrations, las dos cosas dentro de UNA transaccion.
#
#   Ver que pasaria (no toca nada):   bash scripts/aplicar-migracion-catalogo-web.sh
#   Aplicar de verdad:                APLICAR=si bash scripts/aplicar-migracion-catalogo-web.sh
#
# Se puede volver a ejecutar: el SQL es idempotente (ADD COLUMN IF NOT EXISTS)
# y la fila del registro solo se apunta si no estaba.
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
RAIZ="$PWD"

MIGRACION=20261025120000_insumo_catalogo_web
SQL="prisma/migrations/$MIGRACION/migration.sql"
# Las columnas que anade, para mirar antes y comprobar despues.
COLUMNAS=(publicado_web subcategoria marca etiqueta descripcion descripcion_larga
          imagenes especificaciones con_variantes orden_web)

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
gris()  { printf '\033[90m%s\033[0m\n' "$*"; }

command -v psql >/dev/null || { rojo "Falta psql. Instalalo con: sudo apt install postgresql-client"; exit 1; }
[ -f "$SQL" ] || { rojo "FALTA el fichero $SQL"; exit 1; }

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

# Host y base, con usuario y contrasena tapados (hasta la ultima @, por si la
# contrasena llevara una sin codificar).
DESTINO="$(printf '%s' "$DATABASE_URL" | sed -E 's#^([a-z]+)://.*@#\1://***:***@#')"

echo
echo "============================================================"
echo " Migracion del catalogo web -> BASE DE DATOS"
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
  echo "  La base de desarrollo no tiene registro: ahi basta con aplicar el SQL,"
  echo "  que es idempotente:  psql \"\$DATABASE_URL\" -f $SQL"
  exit 1
fi

# ---- La tabla la crean las migraciones de stock ----------------------------
if [ "$(psql "$DATABASE_URL" -qtA -c "SELECT to_regclass('insumos') IS NOT NULL;")" != "t" ]; then
  rojo "No existe la tabla insumos: faltan las migraciones de stock."
  echo "  Aplicalas antes con scripts/aplicar-migraciones-pendientes.sh."
  exit 1
fi

# ---- Estado actual ---------------------------------------------------------
LISTA="$(printf "'%s'," "${COLUMNAS[@]}")"; LISTA="${LISTA%,}"
FALTAN="$(psql "$DATABASE_URL" -qtA -c "
  SELECT string_agg(c, ' ' ORDER BY c)
    FROM unnest(ARRAY[$LISTA]) AS c
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = current_schema()
                        AND table_name = 'insumos' AND column_name = c);")"
APUNTADA="$(psql "$DATABASE_URL" -qtA -c "SELECT count(*) FROM \"_prisma_migrations\" WHERE migration_name = '$MIGRACION' AND rolled_back_at IS NULL;")"

echo "Estado:"
if [ -z "$FALTAN" ]; then
  verde "  [ya estan]     las ${#COLUMNAS[@]} columnas nuevas de insumos"
else
  echo   "  [faltan]       columnas de insumos: $FALTAN"
fi
if [ "$APUNTADA" -gt 0 ]; then
  verde "  [ya apuntada]  $MIGRACION"
else
  echo   "  [sin apuntar]  $MIGRACION"
fi
echo

if [ -z "$FALTAN" ] && [ "$APUNTADA" -gt 0 ]; then
  verde "No hay nada que aplicar. La base esta al dia."
  exit 0
fi
if [ -n "$FALTAN" ] && [ "$APUNTADA" -gt 0 ]; then
  rojo "AVISO: esta apuntada en el registro pero le faltan columnas."
  echo "  Se crean las que faltan (el SQL es idempotente) y la fila no se toca."
  echo
fi

if [ "${APLICAR:-}" != "si" ]; then
  echo "------------------------------------------------------------"
  echo "Esto ha sido un ENSAYO: no se ha tocado nada."
  echo "Para aplicarla de verdad:"
  echo
  echo "  APLICAR=si bash scripts/aplicar-migracion-catalogo-web.sh"
  echo "------------------------------------------------------------"
  exit 0
fi

# ---- Aplicar ---------------------------------------------------------------
echo "Aplicando, en una sola transaccion:"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
SUMA="$(sha256sum "$SQL" | cut -d' ' -f1)"
COMBINADO="$TMP/$MIGRACION.sql"
{
  cat <<'EOF'
-- Si algo tiene la tabla bloqueada, mejor fallar a los 10 s que dejar el
-- inventario esperando detras del ALTER.
SET LOCAL lock_timeout = '10s';

EOF
  cat "$SQL"
  cat <<EOF

-- Apunta la migracion en el registro de Prisma, dentro de la misma
-- transaccion y solo si no estaba: o entran las dos cosas, o ninguna.
INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT md5(random()::text || clock_timestamp()::text)::uuid::text,
       '$SUMA', now(), '$MIGRACION', NULL, NULL, now(), 1
 WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations"
                    WHERE migration_name = '$MIGRACION' AND rolled_back_at IS NULL);
EOF
} > "$COMBINADO"

printf '  %-42s ' "$MIGRACION"
if psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 --single-transaction -f "$COMBINADO" >"$TMP/salida.log" 2>&1; then
  verde "OK"
else
  rojo "FALLO (no se ha aplicado nada)"
  echo
  gris "  --- lo que dijo postgres ---"
  sed 's/^/  /' "$TMP/salida.log"
  exit 1
fi

# ---- Comprobacion final ----------------------------------------------------
echo
echo "Comprobando..."
psql "$DATABASE_URL" -q -c "
  SELECT column_name AS columna, data_type AS tipo, column_default AS por_defecto
    FROM information_schema.columns
   WHERE table_schema = current_schema() AND table_name = 'insumos'
     AND column_name IN ($LISTA)
   ORDER BY ordinal_position;"
psql "$DATABASE_URL" -q -c "
  SELECT migration_name AS migracion,
         to_char(finished_at, 'YYYY-MM-DD HH24:MI') AS aplicada,
         left(checksum, 12) AS checksum
    FROM \"_prisma_migrations\"
   WHERE migration_name = '$MIGRACION' AND rolled_back_at IS NULL;"

HAY="$(psql "$DATABASE_URL" -qtA -c "
  SELECT count(*) FROM information_schema.columns
   WHERE table_schema = current_schema() AND table_name = 'insumos'
     AND column_name IN ($LISTA);")"
if [ "$HAY" -ne "${#COLUMNAS[@]}" ]; then
  rojo "Solo hay $HAY de las ${#COLUMNAS[@]} columnas. No despliegues todavia."
  exit 1
fi
echo
verde "Listo: las ${#COLUMNAS[@]} columnas estan y la migracion queda apuntada."
echo "Ahora ya se puede desplegar el backend."
