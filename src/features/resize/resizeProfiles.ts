import type { ImageFitMode } from '../../types/images';

export type ResizePresetCategory = 'custom' | 'social' | 'web';
export type ResizeMethod =
  | 'exact'
  | 'width'
  | 'height'
  | 'percentage'
  | 'max-width'
  | 'max-height'
  | 'max-bounds'
  | 'longest-edge'
  | 'shortest-edge'
  | 'megapixels';
export type { ImageFitMode } from '../../types/images';
export type AspectRatioId =
  'original' | '1:1' | '4:3' | '3:2' | '16:9' | '9:16' | '4:5' | '5:4' | '21:9' | 'custom';

export interface DimensionPreset {
  readonly id: string;
  readonly platform: SocialPlatform;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly fit: ImageFitMode;
  readonly guidance: 'official' | 'common-canvas';
  readonly sourceUrl: string;
}

export type SocialPlatform =
  | 'Instagram'
  | 'Facebook'
  | 'LinkedIn'
  | 'YouTube'
  | 'TikTok'
  | 'X'
  | 'Pinterest'
  | 'WhatsApp'
  | 'Discord'
  | 'Twitch';

const META_GUIDE = 'https://www.facebook.com/business/ads-guide';

export const SOCIAL_PRESETS: readonly DimensionPreset[] = [
  {
    id: 'instagram-square',
    platform: 'Instagram',
    label: 'Square post',
    width: 1080,
    height: 1080,
    fit: 'cover',
    guidance: 'official',
    sourceUrl: META_GUIDE
  },
  {
    id: 'instagram-portrait',
    platform: 'Instagram',
    label: 'Portrait post',
    width: 1080,
    height: 1350,
    fit: 'cover',
    guidance: 'official',
    sourceUrl: META_GUIDE
  },
  {
    id: 'instagram-story',
    platform: 'Instagram',
    label: 'Story / Reel',
    width: 1080,
    height: 1920,
    fit: 'cover',
    guidance: 'official',
    sourceUrl: 'https://www.facebook.com/business/ads/facebook-instagram-reels-ads'
  },
  {
    id: 'facebook-feed',
    platform: 'Facebook',
    label: 'Feed landscape',
    width: 1200,
    height: 630,
    fit: 'cover',
    guidance: 'official',
    sourceUrl: META_GUIDE
  },
  {
    id: 'facebook-story',
    platform: 'Facebook',
    label: 'Story',
    width: 1080,
    height: 1920,
    fit: 'cover',
    guidance: 'official',
    sourceUrl: META_GUIDE
  },
  {
    id: 'linkedin-landscape',
    platform: 'LinkedIn',
    label: 'Landscape post',
    width: 1200,
    height: 628,
    fit: 'cover',
    guidance: 'official',
    sourceUrl: 'https://www.linkedin.com/help/linkedin/answer/a426534'
  },
  {
    id: 'linkedin-portrait',
    platform: 'LinkedIn',
    label: 'Portrait post',
    width: 720,
    height: 900,
    fit: 'cover',
    guidance: 'official',
    sourceUrl: 'https://www.linkedin.com/help/linkedin/answer/a426534'
  },
  {
    id: 'linkedin-cover',
    platform: 'LinkedIn',
    label: 'Profile cover',
    width: 1584,
    height: 396,
    fit: 'cover',
    guidance: 'official',
    sourceUrl: 'https://www.linkedin.com/help/linkedin/answer/a568217'
  },
  {
    id: 'youtube-thumbnail',
    platform: 'YouTube',
    label: 'Video thumbnail',
    width: 3840,
    height: 2160,
    fit: 'cover',
    guidance: 'official',
    sourceUrl: 'https://support.google.com/youtube/answer/72431'
  },
  {
    id: 'youtube-banner',
    platform: 'YouTube',
    label: 'Channel banner',
    width: 2560,
    height: 1440,
    fit: 'cover',
    guidance: 'official',
    sourceUrl: 'https://support.google.com/youtube/answer/12950272'
  },
  {
    id: 'tiktok-portrait',
    platform: 'TikTok',
    label: 'Portrait photo',
    width: 1080,
    height: 1920,
    fit: 'cover',
    guidance: 'official',
    sourceUrl: 'https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide'
  },
  {
    id: 'tiktok-square',
    platform: 'TikTok',
    label: 'Square photo',
    width: 1080,
    height: 1080,
    fit: 'cover',
    guidance: 'official',
    sourceUrl: 'https://developers.tiktok.com/docs/en/share-kit-ios-quickstart-v2'
  },
  {
    id: 'x-header',
    platform: 'X',
    label: 'Profile header',
    width: 1500,
    height: 500,
    fit: 'cover',
    guidance: 'official',
    sourceUrl:
      'https://help.x.com/en/managing-your-account/common-issues-when-uploading-profile-photo.html'
  },
  {
    id: 'x-profile',
    platform: 'X',
    label: 'Profile image',
    width: 400,
    height: 400,
    fit: 'cover',
    guidance: 'official',
    sourceUrl:
      'https://help.x.com/en/managing-your-account/common-issues-when-uploading-profile-photo.html'
  },
  {
    id: 'pinterest-pin',
    platform: 'Pinterest',
    label: 'Standard Pin',
    width: 1000,
    height: 1500,
    fit: 'cover',
    guidance: 'official',
    sourceUrl: 'https://help.pinterest.com/en/business/article/pinterest-product-specs'
  },
  {
    id: 'pinterest-story',
    platform: 'Pinterest',
    label: 'Full-screen Pin',
    width: 1080,
    height: 1920,
    fit: 'cover',
    guidance: 'official',
    sourceUrl: 'https://help.pinterest.com/en-gb/article/review-pin-specs'
  },
  {
    id: 'whatsapp-status',
    platform: 'WhatsApp',
    label: 'Status canvas',
    width: 1080,
    height: 1920,
    fit: 'cover',
    guidance: 'common-canvas',
    sourceUrl: 'https://faq.whatsapp.com/'
  },
  {
    id: 'whatsapp-profile',
    platform: 'WhatsApp',
    label: 'Profile canvas',
    width: 640,
    height: 640,
    fit: 'cover',
    guidance: 'common-canvas',
    sourceUrl: 'https://faq.whatsapp.com/'
  },
  {
    id: 'discord-banner',
    platform: 'Discord',
    label: 'Server banner',
    width: 960,
    height: 540,
    fit: 'cover',
    guidance: 'official',
    sourceUrl: 'https://support.discord.com/hc/en-us/articles/360028716472-Server-Banners'
  },
  {
    id: 'twitch-banner',
    platform: 'Twitch',
    label: 'Profile banner',
    width: 1200,
    height: 480,
    fit: 'cover',
    guidance: 'official',
    sourceUrl: 'https://help.twitch.tv/s/article/channel-page-setup'
  },
  {
    id: 'twitch-profile',
    platform: 'Twitch',
    label: 'Profile image',
    width: 256,
    height: 256,
    fit: 'cover',
    guidance: 'official',
    sourceUrl: 'https://help.twitch.tv/s/article/twitch-account-settings'
  }
] as const;

export const SOCIAL_PLATFORMS = [
  'Instagram',
  'Facebook',
  'LinkedIn',
  'YouTube',
  'TikTok',
  'X',
  'Pinterest',
  'WhatsApp',
  'Discord',
  'Twitch'
] as const satisfies readonly SocialPlatform[];

export const WEB_PRESETS = [
  { id: 'web-hero', label: 'Web hero', width: 2560, height: 1440, fit: 'cover' },
  { id: 'full-hd', label: 'Full HD', width: 1920, height: 1080, fit: 'contain' },
  { id: 'open-graph', label: 'Open Graph', width: 1200, height: 630, fit: 'cover' },
  { id: 'hd', label: 'HD', width: 1280, height: 720, fit: 'contain' },
  { id: 'email', label: 'Email', width: 1600, height: 1200, fit: 'contain' }
] as const satisfies readonly Omit<DimensionPreset, 'guidance' | 'platform' | 'sourceUrl'>[];

export const ASPECT_RATIOS: Readonly<
  Record<Exclude<AspectRatioId, 'original' | 'custom'>, number>
> = {
  '1:1': 1,
  '4:3': 4 / 3,
  '3:2': 3 / 2,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '4:5': 4 / 5,
  '5:4': 5 / 4,
  '21:9': 21 / 9
};

export const SOCIAL_PRESETS_VERIFIED_ON = '2026-08-24';

export function presetsForPlatform(platform: SocialPlatform) {
  return SOCIAL_PRESETS.filter((preset) => preset.platform === platform);
}
