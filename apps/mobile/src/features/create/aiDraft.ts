import * as Crypto from 'expo-crypto';
import { CATEGORIES, type CampaignContent, type Category } from '@amplify/domain';

export interface AiDraft {
  title: string;
  summary: string;
  category: string;
  headline: string;
  intro: string;
  paragraphs: { heading?: string; text: string }[];
  stat?: { value: string; label: string } | null;
  actions: string[];
  adHeadline: string;
  adDescription: string;
  cta: string;
  interests: string[];
}
export interface AiDraftResult {
  draft: AiDraft;
  source: 'ai' | 'template' | 'sample';
}

const id = () => Crypto.randomUUID().slice(0, 8);

/**
 * Apply AI suggestions to a draft. Every field it fills is recorded in `aiSuggested`
 * so the UI marks it until the creator edits or keeps it. With `onlyEmpty`, nothing the
 * creator already wrote is overwritten. The funding goal is never touched.
 */
export function applyAiDraft(c: CampaignContent, d: AiDraft, opts: { onlyEmpty?: boolean } = {}) {
  const suggested = new Set(c.aiSuggested);
  const fill = (path: string, isEmpty: boolean, apply: () => void) => {
    if (opts.onlyEmpty && !isEmpty) return;
    apply();
    suggested.add(path);
  };
  fill('basics.title', !c.basics.title.trim(), () => (c.basics.title = d.title));
  fill('basics.summary', !c.basics.summary.trim(), () => (c.basics.summary = d.summary));
  if ((CATEGORIES as readonly string[]).includes(d.category)) {
    fill('basics.category', !c.basics.category, () => (c.basics.category = d.category as Category));
  }
  fill('story.headline', !c.story.headline.trim(), () => (c.story.headline = d.headline));
  fill('story.intro', !c.story.intro.trim(), () => (c.story.intro = d.intro));
  if (!opts.onlyEmpty || c.story.blocks.length === 0) {
    const blocks: CampaignContent['story']['blocks'] = [];
    d.paragraphs.forEach((p, i) => {
      if (p.heading) blocks.push({ id: id(), type: 'heading', text: p.heading });
      blocks.push({ id: id(), type: 'paragraph', text: p.text, sourceIds: [] });
      if (i === 0 && d.stat?.value) blocks.push({ id: id(), type: 'stat', value: d.stat.value, text: d.stat.label, sourceIds: [] });
    });
    if (blocks.length) {
      c.story.blocks = blocks;
      suggested.add('story.blocks');
    }
  }
  if (d.actions.length) fill('story.actions', c.story.actions.length === 0, () => (c.story.actions = d.actions));
  fill('visuals.adHeadline', !c.visuals.adHeadline.trim(), () => (c.visuals.adHeadline = d.adHeadline));
  fill('visuals.adDescription', !c.visuals.adDescription.trim(), () => (c.visuals.adDescription = d.adDescription));
  if (d.cta) fill('visuals.cta', !c.visuals.cta.trim() || c.visuals.cta === 'Learn more', () => (c.visuals.cta = d.cta));
  if (d.interests.length) fill('reach.interests', c.reach.interests.length === 0, () => (c.reach.interests = d.interests));
  c.aiSuggested = [...suggested];
}
