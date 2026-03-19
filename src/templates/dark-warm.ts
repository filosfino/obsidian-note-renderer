export const TEMPLATE_DARK_WARM = `
/* ── Dark Warm (暖色深底) ──────────────────────────────
 *  取色自「我以为在看别人的故事」实际小红书页面。
 *  暖灰底色 + 米白文字 + 暖金高亮，适合情感/故事向文章。
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
  background: #3c3a38;
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
  padding-top: 20%;
  position: relative;
}

/* Large quotation mark — visual anchor for upper space */
.nr-cover-content::before {
  content: "\\201C";
  position: absolute;
  top: 4%;
  left: 0;
  font-size: 240px;
  font-weight: 700;
  color: rgba(240, 212, 114, 0.12);
  line-height: 1;
  font-family: Georgia, "Times New Roman", serif;
}

/* Subtle golden glow behind text area */
.nr-cover-content::after {
  content: "";
  position: absolute;
  left: -40px;
  bottom: 25%;
  width: 400px;
  height: 300px;
  background: radial-gradient(ellipse, rgba(240, 212, 114, 0.06) 0%, transparent 70%);
  pointer-events: none;
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
  text-indent: 2em;
  text-align: justify;
  word-break: break-all;
}

.nr-page-content blockquote {
  border-left: 6px solid #f0d472;
  padding: 8px 0 8px 24px;
  margin: 20px 0;
  color: #c0b8a8;
  font-style: italic;
  text-indent: 0;
}

.nr-page-content ul,
.nr-page-content ol {
  padding-left: 40px;
  margin: 0 0 24px 0;
}

.nr-page-content li {
  margin-bottom: 8px;
  text-indent: 0;
}

.nr-page-content code {
  background: #3a3630;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.9em;
  color: #e8dcc0;
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
