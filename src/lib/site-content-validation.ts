export class SiteContentInputError extends Error {}

const optionalFields = new Set([
  'credit',
  'sourceUrl',
  'shareImageUrl',
  'caption',
  'whatsappNumber',
  'whatsappGreeting',
]);

function cleanString(value: unknown, path: string) {
  if (typeof value !== 'string')
    throw new SiteContentInputError(`${path} harus berupa teks.`);
  const result = value.trim();
  const key = path.split('.').at(-1) ?? '';
  const isOptional = optionalFields.has(key) || path.startsWith('socials.');
  if (!result && !isOptional)
    throw new SiteContentInputError(`${path} wajib diisi.`);
  const max = key === 'description' || key.startsWith('body') ? 2_000 : 600;
  if (result.length > max)
    throw new SiteContentInputError(`${path} terlalu panjang.`);
  if (/Url$/.test(key) && result) {
    if (result.startsWith('/')) return result;
    try {
      const url = new URL(result);
      if (url.protocol !== 'https:') throw new Error();
    } catch {
      throw new SiteContentInputError(`${path} harus berupa URL HTTPS.`);
    }
  }
  if (
    key === 'focalPoint' &&
    !['center', 'top', 'bottom', 'left', 'right'].includes(result)
  )
    throw new SiteContentInputError(`${path} tidak valid.`);
  return result;
}

export function sanitizeSiteContent(
  template: unknown,
  input: unknown,
  path = '',
): unknown {
  if (typeof template === 'string') return cleanString(input, path);
  if (Array.isArray(template)) {
    if (!Array.isArray(input))
      throw new SiteContentInputError(`${path} harus berupa daftar.`);
    if (!template.length && path.startsWith('featured.')) {
      if (input.length > 4)
        throw new SiteContentInputError(`${path} maksimal berisi 4 item.`);
      return input.map((item) => {
        if (typeof item !== 'string' || !/^[0-9a-f-]{36}$/i.test(item))
          throw new SiteContentInputError(`${path} berisi ID tidak valid.`);
        return item;
      });
    }
    if (!input.length)
      throw new SiteContentInputError(`${path} minimal berisi satu item.`);
    if (input.length > 12)
      throw new SiteContentInputError(`${path} maksimal berisi 12 item.`);
    const itemTemplate = template[0];
    return input.map((item, index) =>
      sanitizeSiteContent(itemTemplate, item, `${path}.${index}`),
    );
  }
  if (template && typeof template === 'object') {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new SiteContentInputError(`${path} tidak valid.`);
    return Object.fromEntries(
      Object.entries(template).map(([key, child]) => [
        key,
        sanitizeSiteContent(
          child,
          (input as Record<string, unknown>)[key],
          path ? `${path}.${key}` : key,
        ),
      ]),
    );
  }
  throw new SiteContentInputError(`${path} tidak valid.`);
}
