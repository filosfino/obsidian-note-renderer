export const THEME_MIST = `
/* ── Mist (雾霾蓝) ──────────────────────────────────────
 *  冷调文艺。雾蓝底 + 蓝灰强调，适合文学/思考/内省类内容。
 */

.nr-page {
  background: #e4eaf0;
  color: #4a5565;
  font-family: -apple-system, "PingFang SC", "Noto Sans SC", sans-serif;
  font-size: 32px;
  line-height: 1.75;
  letter-spacing: 0.05em;
  border-radius: var(--nr-page-radius);
}

/* ── Cover page ── */

.nr-page-cover {
  background:
    radial-gradient(circle at 85% 10%, rgba(134, 150, 167, 0.08) 0%, transparent 40%),
    radial-gradient(circle at 10% 90%, rgba(134, 150, 167, 0.05) 0%, transparent 40%),
    #e4eaf0;
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
  color: #354d68;
}

.nr-cover-content p {
  margin: 12px 0;
  color: #354d68;
}

.nr-cover-content strong {
  font-weight: 900;
  color: #243a53;
}

/* Cover emphasis: marker highlight — bottom-half stripe */
.nr-cover-content mark {
  background: linear-gradient(to top, rgba(53,77,104,0.20) 35%, transparent 35%);
  padding: 0 4px;
  color: inherit;
}

/* Cover emphasis: hand-drawn underline */
.nr-cover-content u {
  text-decoration: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 12'%3E%3Cpath d='M2 8 Q30 2 50 7 T100 6 T150 8 T198 5' fill='none' stroke='%23354d68' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: repeat-x;
  background-position: bottom;
  background-size: 200px 12px;
  padding-bottom: 8px;
  color: inherit;
}

/* Cover image overlay: text on image */
.nr-cover-has-image .nr-cover-content {
  background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 50%, transparent 100%);
  justify-content: flex-end;
  border-radius: var(--nr-page-radius);
}
.nr-cover-has-image .nr-cover-content h1,
.nr-cover-has-image .nr-cover-content p {
  color: #fff;
  -webkit-text-stroke: var(--nr-stroke-width, 6px) rgba(0,0,0,0.7);
  paint-order: stroke fill;
  text-shadow: 0 4px 16px rgba(0,0,0,0.5);
}
.nr-cover-has-image .nr-cover-content mark {
  background: linear-gradient(to top, rgba(255,255,255,0.35) 35%, transparent 35%);
}

.nr-cover-has-image .nr-cover-content strong {
  color: inherit;
}

/* ── Body pages ── */

.nr-page-body {
  background: #e4eaf0;
  box-shadow: inset 6px 0 12px -6px rgba(0, 0, 0, 0.06);
}

.nr-page-content p {
  margin: 0 0 1.2em 0;
  text-align: justify;
  word-break: normal;
  overflow-wrap: break-word;
}

.nr-page-content blockquote {
  border-left: var(--nr-quote-border-width) solid #8696a7;
  padding: var(--nr-quote-padding-y) 0 var(--nr-quote-padding-y) var(--nr-quote-padding-left);
  margin: var(--nr-quote-margin-y) 0;
  color: #556170;
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
  background: #dce2e9;
  padding: var(--nr-inline-code-padding-y) var(--nr-inline-code-padding-x);
  border-radius: var(--nr-block-radius);
  font-size: 0.85em;
  color: #645776;
}

.nr-page-content pre {
  background: #dce2e9;
  padding: var(--nr-block-padding);
  border-radius: var(--nr-block-radius);
  overflow-x: auto;
  margin: var(--nr-block-margin-y) 0;
}

.nr-page-content pre code {
  color: #4a5565;
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

/* Mist blue accent for bold text */
.nr-page-content strong {
  font-weight: 700;
  color: #354d68;
}

.nr-page-content em {
  font-style: italic;
  color: #556170;
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
