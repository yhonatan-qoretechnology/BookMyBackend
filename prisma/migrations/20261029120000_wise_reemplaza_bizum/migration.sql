-- El botón de pago Bizum de la app pasa a ser Wise: se renombra el valor
-- (los pagos que ya hubiera con BIZUM quedan como WISE).
ALTER TYPE "PaymentMethod" RENAME VALUE 'BIZUM' TO 'WISE';
