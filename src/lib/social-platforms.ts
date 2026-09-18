export const socialPlatforms = [
  {
    key: 'instagram',
    label: 'Instagram',
    hint: 'Foto, Reels, dan Stories',
    placeholder: 'https://www.instagram.com/namaakun',
    domains: ['instagram.com'],
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    hint: 'Video pendek dan tren perjalanan',
    placeholder: 'https://www.tiktok.com/@namaakun',
    domains: ['tiktok.com'],
  },
  {
    key: 'youtube',
    label: 'YouTube',
    hint: 'Video perjalanan berdurasi panjang',
    placeholder: 'https://www.youtube.com/@namaakun',
    domains: ['youtube.com', 'youtu.be'],
  },
  {
    key: 'facebook',
    label: 'Facebook',
    hint: 'Halaman bisnis dan komunitas',
    placeholder: 'https://www.facebook.com/namaakun',
    domains: ['facebook.com', 'fb.com'],
  },
  {
    key: 'x',
    label: 'X',
    hint: 'Kabar singkat dan percakapan',
    placeholder: 'https://x.com/namaakun',
    domains: ['x.com', 'twitter.com'],
  },
  {
    key: 'threads',
    label: 'Threads',
    hint: 'Cerita singkat dan komunitas',
    placeholder: 'https://www.threads.net/@namaakun',
    domains: ['threads.net'],
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    hint: 'Profil dan jaringan profesional',
    placeholder: 'https://www.linkedin.com/company/namaakun',
    domains: ['linkedin.com'],
  },
  {
    key: 'pinterest',
    label: 'Pinterest',
    hint: 'Inspirasi visual perjalanan',
    placeholder: 'https://www.pinterest.com/namaakun',
    domains: ['pinterest.com', 'pin.it'],
  },
  {
    key: 'telegram',
    label: 'Telegram',
    hint: 'Grup atau kanal komunitas',
    placeholder: 'https://t.me/namaakun',
    domains: ['t.me', 'telegram.me', 'telegram.org'],
  },
  {
    key: 'spotify',
    label: 'Spotify',
    hint: 'Podcast atau playlist perjalanan',
    placeholder: 'https://open.spotify.com/user/namaakun',
    domains: ['spotify.com'],
  },
  {
    key: 'discord',
    label: 'Discord',
    hint: 'Server komunitas perjalanan',
    placeholder: 'https://discord.gg/kodeundangan',
    domains: ['discord.gg', 'discord.com'],
  },
] as const;

export type SocialPlatformKey = (typeof socialPlatforms)[number]['key'];
export type SocialIconName = SocialPlatformKey | 'whatsapp';
export type SocialLinks = Record<SocialPlatformKey, string>;

export const emptySocialLinks = Object.fromEntries(
  socialPlatforms.map(({ key }) => [key, '']),
) as SocialLinks;

export const activeSocialLinks = (links: SocialLinks) =>
  socialPlatforms.flatMap((platform) => {
    const href = links[platform.key];
    return href ? [{ ...platform, href }] : [];
  });

const matchesDomain = (hostname: string, domain: string) =>
  hostname === domain || hostname.endsWith(`.${domain}`);

export function validateSocialLinks(links: SocialLinks) {
  for (const platform of socialPlatforms) {
    const value = links[platform.key];
    if (!value) continue;
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (!platform.domains.some((domain) => matchesDomain(hostname, domain)))
      throw new Error(
        `${platform.label} harus memakai domain ${platform.domains.join(' atau ')}.`,
      );
  }
}
