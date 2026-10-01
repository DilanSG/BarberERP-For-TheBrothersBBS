// Datos del establecimiento (frontend).
//
// Los valores fiscales y de contacto se pueden sobrescribir sin tocar código
// definiendo variables de entorno VITE_BUSINESS_* en el archivo .env

export const BUSINESS = {
  name: import.meta.env.VITE_BUSINESS_NAME || 'THE BROTHERS BARBER SHOP',
  nit: import.meta.env.VITE_BUSINESS_NIT || '123456-8',
  address: import.meta.env.VITE_BUSINESS_ADDRESS || 'Cra 77vBis #52 A - 08, Bogotá, Cundinamarca',
  phone: import.meta.env.VITE_BUSINESS_PHONE || '311 588 2528',
  phoneIntl: import.meta.env.VITE_BUSINESS_PHONE_INTL || '+57 311 588 2528',
  taxRegime: import.meta.env.VITE_BUSINESS_TAX_REGIME || 'No responsable de IVA (Art. 437 ET)',
  dianResolution: import.meta.env.VITE_BUSINESS_DIAN_RESOLUTION || '18760000012345 del 01/01/2025',
  ivaRate: Number(import.meta.env.VITE_BUSINESS_IVA_RATE ?? 0.19),
  mapsEmbedUrl: import.meta.env.VITE_BUSINESS_MAPS_URL || 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15907.448844294731!2d-74.16188815134278!3d4.618659698034156!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e3f9fadb32531a3%3A0xad47ce8d546359c!2sThe%20brothers%20barber!5e0!3m2!1ses!2sco!4v1756390613507!5m2!1ses!2sco'
};

// ¿El establecimiento es responsable de IVA? (según el régimen configurado)
// Nota: "No responsable de IVA" NO debe considerarse responsable.
export const isIvaResponsible = () => {
  const regime = BUSINESS.taxRegime.toLowerCase();
  return regime.includes('responsable de iva') && !regime.includes('no responsable');
};

export default BUSINESS;
