export const THEME_INK_GOLD = `
/* ── Ink Gold (暗金) ──────────────────────────────────
 *  仪式感。深底 + 金色引号装饰 + 金色强调，适合观点/引言类文章。
 */

.nr-page {
  background: #333;
  color: #d4d4d4;
  font-family: -apple-system, "PingFang SC", "Noto Sans SC", sans-serif;
  font-size: 32px;
  line-height: 1.75;
  letter-spacing: 0.05em;
  border-radius: var(--nr-page-radius);
}

/* ── Cover page ── */

.nr-page-cover {
  background:
    radial-gradient(circle at 20% 80%, rgba(255,255,255,0.02) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(255,255,255,0.02) 0%, transparent 50%),
    #2a2a2a;
  border: 1px solid #555;
}

.nr-cover-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  height: 100%;
  position: relative;
}

.nr-cover-content h1 {
  font-size: 68px;
  font-weight: 800;
  line-height: 1.3;
  margin: 0;
  color: #f5d040;
}

.nr-cover-content p {
  margin: 8px 0;
  color: #f5d040;
}

.nr-cover-content strong {
  font-weight: 900;
  color: #ffe07a;
}

/* Cover emphasis: marker highlight — bottom-half stripe */
.nr-cover-content mark {
  background: linear-gradient(to top, rgba(245,208,64,0.25) 35%, transparent 35%);
  padding: 0 4px;
  color: inherit;
}

/* Cover emphasis: hand-drawn underline */
.nr-cover-content u {
  text-decoration: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 12'%3E%3Cpath d='M2 8 Q30 2 50 7 T100 6 T150 8 T198 5' fill='none' stroke='%23f5d040' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E");
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
  border-radius: var(--nr-page-radius);
}
.nr-cover-has-image .nr-cover-content h1,
.nr-cover-has-image .nr-cover-content p {
  color: #fff;
  -webkit-text-stroke: var(--nr-stroke-width, 6px) rgba(0,0,0,0.8);
  paint-order: stroke fill;
  text-shadow: 0 4px 16px rgba(0,0,0,0.6);
}
.nr-cover-has-image .nr-cover-content mark {
  background: linear-gradient(to top, rgba(255,255,255,0.3) 35%, transparent 35%);
}

.nr-cover-has-image .nr-cover-content strong {
  color: inherit;
}

/* ── Body pages ── */

.nr-page-body {
  background: #333;
  border: 1px solid #4a4a4a;
}

.nr-page-content p {
  margin: 0 0 1.2em 0;
  text-align: justify;
  word-break: normal;
  overflow-wrap: break-word;
}

.nr-page-content blockquote {
  border-left: var(--nr-quote-border-width) solid #e8c36a;
  padding: var(--nr-quote-padding-y) 0 var(--nr-quote-padding-y) var(--nr-quote-padding-left);
  margin: var(--nr-quote-margin-y) 0;
  color: #bbb;
  font-style: italic;
}

.nr-page-content ul,
.nr-page-content ol {
  padding-left: var(--nr-list-indent);
  margin: 0 0 var(--nr-list-margin-bottom) 0;
}

.nr-page-content li {
  margin-bottom: var(--nr-list-item-margin-bottom);
}

.nr-page-content code {
  font-family: "SF Mono", "Menlo", monospace;
  background: #2a2a2a;
  padding: var(--nr-inline-code-padding-y) var(--nr-inline-code-padding-x);
  border-radius: var(--nr-block-radius);
  font-size: 0.85em;
  color: #d4956a;
}

.nr-page-content pre {
  background: #2a2a2a;
  padding: var(--nr-block-padding);
  border-radius: var(--nr-block-radius);
  overflow-x: auto;
  margin: var(--nr-block-margin-y) 0;
}

.nr-page-content img,
.nr-page-content .image-embed.image-embed img:not([width]) {
  max-width: 100% !important;
  max-height: none !important;
  height: auto;
  display: block;
  margin: var(--nr-block-margin-y) auto;
  border-radius: var(--nr-block-radius);
}

.nr-page-content .image-embed,
.nr-page-content .internal-embed {
  display: block;
  width: 100%;
}

/* Gold accent for bold text */
.nr-page-content strong {
  font-weight: 700;
  color: #e8c36a;
}

.nr-page-content em {
  font-style: italic;
  color: #e8c36a;
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
