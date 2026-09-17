import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const brandDir = join(projectRoot, 'public', 'brand');
const masterPath = join(brandDir, 'Asset 5.svg');
const source = readFileSync(masterPath, 'utf8');
const palette = {
  accent: '#E15D26',
  ink: '#191B18',
  light: '#FFFFFF',
  mono: '#000000',
};

const leafGroups = [
  ...source.matchAll(/<g>\s*((?:(?!<g>|<\/g>)[\s\S])*)<\/g>/g),
].map((match) => match[1].trim());

if (leafGroups.length !== 3) {
  throw new Error(
    `Struktur master logo berubah: diharapkan 3 grup, ditemukan ${leafGroups.length}.`,
  );
}

const clean = (fragment) =>
  fragment.replace(/\sclass="cls-\d+"/g, '').replace(/^\s+/gm, '');

const [lettering, tagline, accentArtwork] = leafGroups.map(clean);

const svgDocument = ({
  title,
  viewBox,
  body,
}) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-labelledby="brand-title">
  <title id="brand-title">${title}</title>
  ${body}
</svg>
`;

const colorAccentArtwork = (accent, ink) => {
  let firstPath = true;
  return accentArtwork.replace(/<path/g, () => {
    const fill = firstPath ? accent : ink;
    firstPath = false;
    return `<path fill="${fill}"`;
  });
};

const stackedLogo = ({ accent, ink, title }) =>
  svgDocument({
    title,
    // The source art occupied only the middle of a 330 x 354 canvas. This
    // crops the permanent white card and keeps a small, intentional clearspace.
    viewBox: '80 68 170 220',
    body: `<g fill="${ink}">
${lettering}
</g>
<g fill="${accent}">
${tagline}
</g>
<g>
${colorAccentArtwork(accent, ink)}
</g>`,
  });

const variants = {
  color: { accent: palette.accent, ink: palette.ink },
  light: { accent: palette.light, ink: palette.light },
  mono: { accent: palette.mono, ink: palette.mono },
};

for (const [name, colors] of Object.entries(variants)) {
  writeFileSync(
    join(brandDir, `logo-stacked-${name}.svg`),
    stackedLogo({
      ...colors,
      title: `LebihJauh stacked logo — ${name}`,
    }),
  );
}

console.log('Stacked brand assets generated in public/brand/.');
