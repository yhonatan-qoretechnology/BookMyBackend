import { applyDecorators } from '@nestjs/common';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Política de contraseñas de Bookmy: una sola definición para todos los sitios
 * donde se establece una contraseña.
 *
 * Antes cada DTO llevaba su propio `@MinLength(6)` mientras la app móvil exigía
 * en el registro 7 caracteres con mayúscula, minúscula, dígito y símbolo. El
 * resultado era que se podía registrar una cuenta con una contraseña fuerte y
 * acto seguido rebajarla a `123456` desde la recuperación por OTP, que es
 * justamente el camino que usaría un atacante.
 *
 * El servidor es la autoridad: si una regla no está aquí, no se cumple, por muy
 * estricto que sea el formulario del cliente.
 */

export const PASSWORD_MIN_LENGTH = 7;

/**
 * bcrypt ignora todo lo que pase de 72 bytes: sin este tope, dos contraseñas
 * larguísimas que compartan los primeros 72 bytes valdrían la una por la otra.
 */
export const PASSWORD_MAX_LENGTH = 72;

/** Misma regla que valida la app móvil en el registro. */
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{7,}$/;

export const PASSWORD_RULES_MESSAGE =
  'La contraseña debe tener al menos 7 caracteres e incluir una minúscula, una mayúscula, un número y un símbolo.';

/** Ejemplo para Swagger que cumple la política. */
export const PASSWORD_EXAMPLE = 'Bookmy2026!';

/**
 * Aplica la política completa a un campo de contraseña.
 *
 * Se usa en todos los DTO que establecen una contraseña (registro, cambio con
 * contraseña actual, cambio por OTP, alta y cambio desde administración).
 */
export function IsStrongPassword() {
  return applyDecorators(
    IsString(),
    IsNotEmpty(),
    MaxLength(PASSWORD_MAX_LENGTH),
    Matches(PASSWORD_REGEX, { message: PASSWORD_RULES_MESSAGE }),
  );
}
