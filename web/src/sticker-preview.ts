import { previewPacks } from './stickerPreviewCatalog';
import './sticker-preview.css';

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K, className: string, content?: string,
): HTMLElementTagNameMap[K] {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (content) item.textContent = content;
  return item;
}

const host = document.querySelector<HTMLElement>('#sticker-packs')!;
const nav = document.querySelector<HTMLElement>('.sticker-pack-nav')!;
const sections = document.createDocumentFragment();
const links = document.createDocumentFragment();
const sectionLinks = new Map<string, HTMLAnchorElement>();

for (const pack of previewPacks) {
  const link = element('a', '', pack.shortTitle);
  link.href = `#${pack.id}`;
  sectionLinks.set(pack.id, link);
  links.append(link);

  const section = element('section', 'sticker-pack');
  section.id = pack.id;
  section.setAttribute('aria-labelledby', `${pack.id}-title`);
  const heading = element('header', 'sticker-pack-heading');
  const top = element('div', 'sticker-pack-heading-line');
  const title = element('h2', '', pack.title);
  title.id = `${pack.id}-title`;
  top.append(title);
  if (pack.id !== 'redcap-extra') top.append(element('span', 'sticker-count', `${pack.stickers.length}종`));
  heading.append(top, element('p', '', pack.description));

  const grid = element('ul', 'sticker-grid');
  for (const [index, sticker] of pack.stickers.entries()) {
    const item = element('li', 'sticker-tile');
    item.dataset.stickerId = sticker.id;
    const figure = element('figure', 'sticker-bubble');
    const image = element('img', 'sticker-art');
    image.src = sticker.src;
    image.alt = '';
    image.width = 160;
    image.height = 160;
    image.decoding = 'async';
    image.loading = pack.id === 'redcap-extra' && index < 4 ? 'eager' : 'lazy';
    figure.append(image, element('figcaption', 'sticker-caption', sticker.label));
    item.append(figure);
    grid.append(item);
  }
  section.append(heading, grid);
  sections.append(section);
}

host.replaceChildren(sections);
nav.replaceChildren(links);

function updateActiveLink() {
  const hash = location.hash.slice(1);
  const current = sectionLinks.has(hash) ? hash : previewPacks[0].id;
  for (const [id, link] of sectionLinks) {
    if (id === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}

updateActiveLink();
window.addEventListener('hashchange', updateActiveLink);
const initialHash = location.hash.slice(1);
if (sectionLinks.has(initialHash)) document.getElementById(initialHash)?.scrollIntoView();
