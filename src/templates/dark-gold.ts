export const TEMPLATE_DARK_GOLD = `
/* ── Dark Gold (引言风格) ──────────────────────────────
 *  Cover: textured dark bg, large quotation mark, gold title
 *  Body:  dark bg with subtle border, gold highlights
 *  Based on XHS 暗金引言 theme screenshots.
 */

.nr-page {
  background: #3d3d3d;
  color: #d4d4d4;
  font-family: -apple-system, "PingFang SC", "Noto Sans SC", sans-serif;
  font-size: 32px;
  line-height: 1.75;
  letter-spacing: 0.05em;
  border-radius: 16px;
}

/* ── Cover page ── */

.nr-page-cover {
  background:
    radial-gradient(circle at 20% 80%, rgba(255,255,255,0.02) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(255,255,255,0.02) 0%, transparent 50%),
    #3d3d3d;
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

/* Large quotation mark decoration */
.nr-cover-content::before {
  content: "\\201C\\201C";
  position: absolute;
  top: 0;
  left: 0;
  font-size: 120px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.15);
  line-height: 1;
  font-family: Georgia, "Times New Roman", serif;
}

.nr-cover-content h1 {
  font-size: 68px;
  font-weight: 800;
  line-height: 1.3;
  margin: 0;
  color: #e8c36a;
}

.nr-cover-content p {
  margin: 8px 0;
  color: #e8c36a;
}

/* ── Body pages ── */

.nr-page-body {
  background: #333;
  border: 1px solid #4a4a4a;
}

.nr-page-content p {
  margin: 0 0 1.2em 0;
  text-indent: 2em;
  text-align: justify;
  word-break: break-all;
}

/* First paragraph: no indent */
.nr-page-content p:first-child {
  text-indent: 2em;
}

.nr-page-content blockquote {
  border-left: 6px solid #e8c36a;
  padding: 8px 0 8px 24px;
  margin: 20px 0;
  color: #bbb;
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
  background: #2a2a2a;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.9em;
  color: #e0d4b8;
}

.nr-page-content pre {
  background: #2a2a2a;
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
