import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeWhatsAppNumber,
  whatsappNumberFromUrl,
  whatsappUrl,
} from '../src/lib/contact-settings';
import { sanitizeSiteContent } from '../src/lib/site-content-validation';
import {
  activeSocialLinks,
  emptySocialLinks,
  validateSocialLinks,
} from '../src/lib/social-platforms';

const template = {
  seo: { title: 'Home', shareImageUrl: '' },
  hero: {
    image: {
      imageUrl: '/fallback.jpg',
      alt: 'Foto fallback',
      caption: '',
      credit: '',
      sourceUrl: '',
      focalPoint: 'center',
    },
  },
  faq: { items: [{ question: 'Pertanyaan', answer: 'Jawaban' }] },
  featured: { galleryIds: [] as string[] },
};

test('structured page content accepts FAQ and featured ordering', () => {
  const input = structuredClone(template);
  input.faq.items.push({
    question: 'Pertanyaan kedua',
    answer: 'Jawaban kedua',
  });
  input.featured.galleryIds = ['00000000-0000-4000-8000-000000000001'];
  assert.deepEqual(sanitizeSiteContent(template, input), input);
});

test('unsafe media URLs and malformed featured IDs are rejected', () => {
  const unsafe = structuredClone(template);
  unsafe.hero.image.imageUrl = 'http://example.com/photo.jpg';
  assert.throws(() => sanitizeSiteContent(template, unsafe), /URL HTTPS/);

  const malformed = structuredClone(template);
  malformed.featured.galleryIds = ['not-an-id'];
  assert.throws(
    () => sanitizeSiteContent(template, malformed),
    /ID tidak valid/,
  );
});

test('photo focal point and list limits are constrained', () => {
  const badFocus = structuredClone(template);
  badFocus.hero.image.focalPoint = '10% 90%';
  assert.throws(() => sanitizeSiteContent(template, badFocus), /tidak valid/);

  const tooMany = structuredClone(template);
  tooMany.featured.galleryIds = Array.from(
    { length: 5 },
    (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  );
  assert.throws(() => sanitizeSiteContent(template, tooMany), /maksimal/);
});

test('global social links allow empty platforms and validate filled domains', () => {
  const socialTemplate = { socials: structuredClone(emptySocialLinks) };
  const input = structuredClone(socialTemplate);
  input.socials.instagram = 'https://www.instagram.com/lebihjauh.id/';

  const clean = sanitizeSiteContent(socialTemplate, input) as typeof input;
  validateSocialLinks(clean.socials);
  assert.deepEqual(clean, input);
  assert.deepEqual(
    activeSocialLinks(clean.socials).map(({ key }) => key),
    ['instagram'],
  );

  const impersonated = structuredClone(input);
  impersonated.socials.instagram =
    'https://instagram.com.example.test/phishing';
  assert.throws(
    () => validateSocialLinks(impersonated.socials),
    /Instagram harus memakai domain/,
  );
});

test('one WhatsApp number is normalized and reused for public contact links', () => {
  assert.equal(normalizeWhatsAppNumber('0812-3456-7890'), '6281234567890');
  assert.equal(normalizeWhatsAppNumber('+62 812 3456 7890'), '6281234567890');
  assert.equal(
    whatsappNumberFromUrl('https://wa.me/6281234567890'),
    '6281234567890',
  );
  assert.equal(
    whatsappUrl('6281234567890', 'Halo LebihJauh'),
    'https://wa.me/6281234567890?text=Halo+LebihJauh',
  );
  assert.throws(() => normalizeWhatsAppNumber('12345'), /harus memakai nomor/);
});
