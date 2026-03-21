export const TEMPLATE_GRAPHITE = `
/* ── Graphite (石墨) ──────────────────────────────────
 *  冷静克制。深灰底 + 白字，无装饰，适合工具/技术类文章。
 */

.nr-page {
  background: #3a3a3a;
  color: #e0e0e0;
  font-family: -apple-system, "PingFang SC", "Noto Sans SC", sans-serif;
  font-size: 32px;
  line-height: 1.75;
  letter-spacing: 0.05em;
  border-radius: 16px;
}

/* Cover */
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
  background: #fff;
  border-radius: 3px;
}

.nr-cover-content h1 {
  font-size: 72px;
  font-weight: 800;
  line-height: 1.25;
  margin: 0;
  color: #fff;
}

.nr-cover-content p {
  margin: 8px 0;
  color: #fff;
}

/* Cover emphasis: marker highlight — bottom-half stripe */
.nr-cover-content mark {
  background: linear-gradient(to top, rgba(255,255,255,0.15) 35%, transparent 35%);
  padding: 0 4px;
  color: inherit;
}

/* Cover emphasis: hand-drawn underline */
.nr-cover-content u {
  text-decoration: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 12'%3E%3Cpath d='M2 8 Q30 2 50 7 T100 6 T150 8 T198 5' fill='none' stroke='%23ffffff' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E");
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

/* Body */
.nr-page-content p {
  margin: 0 0 1.2em 0;
  text-align: justify;
  word-break: normal;
  overflow-wrap: break-word;
}

.nr-page-content blockquote {
  border-left: 6px solid #555;
  padding: 8px 0 8px 24px;
  margin: 20px 0;
  color: #bbb;
  font-style: italic;
}

.nr-page-content ul,
.nr-page-content ol {
  padding-left: 40px;
  margin: 0 0 24px 0;
}

.nr-page-content li { margin-bottom: 8px; }

.nr-page-content code {
  font-family: "SF Mono", "Menlo", monospace;
  background: #2e2e2e;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.85em;
  color: #eb5757;
}

.nr-page-content pre {
  background: #2e2e2e;
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

.nr-page-content strong { font-weight: 700; color: #fff; }
.nr-page-content em { font-style: italic; }

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
