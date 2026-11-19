/**
 * Modo mantenimiento. En la rama `mantenimiento` esto vale `true`: solo se ve la landing,
 * sin login, registro, pagos ni paneles. En `dev` y `produccion` vale `false`.
 * Es lo ÚNICO que cambia entre `produccion` y `mantenimiento`.
 */
export const EN_MANTENIMIENTO: boolean = true
