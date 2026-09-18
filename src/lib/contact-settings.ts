export const defaultWhatsAppGreeting =
  'Halo LebihJauh, saya ingin bertanya tentang perjalanan.';

export function normalizeWhatsAppNumber(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  if (!/^62\d{8,13}$/.test(digits))
    throw new Error(
      'Nomor WhatsApp utama harus memakai nomor Indonesia yang valid, misalnya 6281234567890.',
    );
  return digits;
}

export function whatsappUrl(number: string, message = '') {
  if (!number) return undefined;
  const url = new URL(`https://wa.me/${number}`);
  if (message.trim()) url.searchParams.set('text', message.trim());
  return url.toString();
}

export function whatsappNumberFromUrl(value: unknown) {
  if (typeof value !== 'string' || !value) return '';
  try {
    const url = new URL(value);
    const candidate =
      url.hostname.toLowerCase() === 'wa.me'
        ? url.pathname.split('/').filter(Boolean)[0]
        : url.searchParams.get('phone');
    return normalizeWhatsAppNumber(candidate);
  } catch {
    return '';
  }
}
