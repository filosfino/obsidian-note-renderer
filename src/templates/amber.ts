export const TEMPLATE_AMBER = `
/* ── Amber (琥珀) ─────────────────────────────────────
 *  温暖故事。暖灰底 + 米白文字 + 暖金高亮 + 噪点纹理。
 *  适合情感/故事向文章。
 */

.nr-page {
  background: #2d2b29;
  color: #e0d6c8;
  font-family: -apple-system, "PingFang SC", "Noto Sans SC", sans-serif;
  font-size: 32px;
  line-height: 1.75;
  letter-spacing: 0.05em;
  border-radius: 16px;
}

/* ── Cover page ── */

.nr-page-cover {
  background: #2d2b29;
  border: 1px solid #504a42;
  /* Noise texture overlay for depth */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E");
}

.nr-cover-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  height: 100%;
  position: relative;
}

/* Decorative accent bar */
.nr-cover-content::before {
  content: "";
  position: absolute;
  left: 0;
  top: 15%;
  width: 6px;
  height: 80px;
  background: #f0d472;
  border-radius: 3px;
}

.nr-cover-content h1 {
  font-size: 68px;
  font-weight: 800;
  line-height: 1.3;
  margin: 0;
  color: #f0d472;
}

.nr-cover-content p {
  margin: 8px 0;
  color: #f0d472;
}

/* Cover emphasis: marker highlight — bottom-half stripe */
.nr-cover-content mark {
  background: linear-gradient(to top, rgba(240,212,114,0.25) 35%, transparent 35%);
  padding: 0 4px;
  color: inherit;
}

/* Cover emphasis: hand-drawn underline */
.nr-cover-content u {
  text-decoration: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 12'%3E%3Cpath d='M2 8 Q30 2 50 7 T100 6 T150 8 T198 5' fill='none' stroke='%23f0d472' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: repeat-x;
  background-position: bottom;
  background-size: 200px 12px;
  padding-bottom: 8px;
  color: inherit;
}

/* Cover image overlay: text on image */
.nr-cover-has-image .nr-cover-content {
  background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.25) 50%, transparent 100%);
  justify-content: flex-end;
  border-radius: 16px;
}
.nr-cover-has-image .nr-cover-content h1,
.nr-cover-has-image .nr-cover-content p {
  color: #fff;
  -webkit-text-stroke: var(--nr-stroke-width, 6px) rgba(0,0,0,0.8);
  paint-order: stroke fill;
  text-shadow: 0 4px 16px rgba(0,0,0,0.6);
}
.nr-cover-has-image .nr-cover-content::before {
  background: #fff;
}
.nr-cover-has-image .nr-cover-content mark {
  background: linear-gradient(to top, rgba(255,255,255,0.3) 35%, transparent 35%);
}

/* ── Body pages ── */

.nr-page-body {
  background: #2d2b29;
  border: 1px solid #3e3a36;
  /* Vignette: subtle darkening at edges */
  box-shadow: inset 0 0 120px rgba(0, 0, 0, 0.15);
  /* Subtle noise texture */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
}

.nr-page-content p {
  margin: 0 0 1.2em 0;
  text-align: justify;
  word-break: normal;
  overflow-wrap: break-word;
}

.nr-page-content blockquote {
  border-left: 6px solid #f0d472;
  padding: 8px 0 8px 24px;
  margin: 20px 0;
  color: #c0b8a8;
  font-style: italic;
}

.nr-page-content ul,
.nr-page-content ol {
  padding-left: 40px;
  margin: 0 0 24px 0;
}

.nr-page-content li {
  margin-bottom: 8px;
}

.nr-page-content code {
  font-family: "SF Mono", "Menlo", monospace;
  background: #3a3630;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.85em;
  color: #d4956a;
}

.nr-page-content pre {
  background: #3a3630;
  padding: 24px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 16px 0;
}

.nr-page-content img,
.nr-page-content .image-embed.image-embed img:not([width]) {
  max-width: 100% !important;
  max-height: none !important;
  height: auto;
  display: block;
  margin: 16px auto;
  border-radius: 8px;
}

.nr-page-content .image-embed,
.nr-page-content .internal-embed {
  display: block;
  width: 100%;
}

/* Gold accent for bold text */
.nr-page-content strong {
  font-weight: 700;
  color: #f0d472;
}

.nr-page-content em {
  font-style: italic;
  color: #f0d472;
}

.nr-oversized {
  display: flex;
  align-items: center;
  justify-content: center;
}
.nr-oversized img {
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
}
`;
