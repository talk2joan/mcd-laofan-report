/*
 * 海报渲染：把订单统计的真实数字画到人格海报底部的三张数据卡上，输出 PNG。
 *
 * 八张海报由 Seedream 生成，版式一致：三张卡位于宽度 7–35% / 37–65% / 67–94%，
 * 高度 76–88.5%。这里用纸色圆角矩形盖住原图卡片内容，再重绘标签和数字。
 */
(function (root) {
  "use strict";

  const CARD_X = [[0.072, 0.352], [0.372, 0.652], [0.672, 0.932]];
  const CARD_Y = [0.775, 0.884];
  const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif';
  const RED = "#DB0007";
  const INK = "#151515";

  const cache = new Map();
  function loadImage(src) {
    if (!cache.has(src)) {
      cache.set(src, new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`海报图片加载失败：${src}`));
        img.src = src;
      }));
    }
    return cache.get(src);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 让文字在给定宽度内：超宽则缩小字号
  function fitFont(ctx, text, weight, size, maxWidth) {
    let s = size;
    ctx.font = `${weight} ${s}px ${FONT}`;
    while (s > 10 && ctx.measureText(text).width > maxWidth) {
      s -= 2;
      ctx.font = `${weight} ${s}px ${FONT}`;
    }
    return s;
  }

  function drawCard(ctx, W, H, idx, card) {
    const [label, value, unit] = card;
    const x0 = CARD_X[idx][0] * W, x1 = CARD_X[idx][1] * W;
    const y0 = CARD_Y[0] * H, y1 = CARD_Y[1] * H;
    const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
    // 内缩一点，保留原图的金色描边与阴影
    const inset = w * 0.045;
    ctx.save();
    roundRect(ctx, x0 + inset, y0 + inset, w - inset * 2, h - inset * 2, w * 0.05);
    ctx.fillStyle = "#FBF8F2";
    ctx.fill();
    ctx.restore();

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = INK;
    fitFont(ctx, label, 800, Math.round(W * 0.026), w * 0.8);
    ctx.fillText(label, cx, y0 + h * 0.36);

    // 数字 + 单位作为一组居中
    const maxW = w * 0.82;
    let vSize = Math.round(W * (String(value).length > 4 ? 0.042 : 0.052));
    const uSize = Math.round(W * 0.024);
    ctx.font = `900 ${uSize}px ${FONT}`;
    const uW = unit ? ctx.measureText(unit).width + W * 0.006 : 0;
    vSize = fitFont(ctx, value, 900, vSize, maxW - uW);
    const vW = ctx.measureText(value).width;
    const start = cx - (vW + uW) / 2;
    const baseline = y0 + h * 0.78;
    ctx.textAlign = "left";
    ctx.fillStyle = RED;
    ctx.font = `900 ${vSize}px ${FONT}`;
    ctx.fillText(value, start, baseline);
    if (unit) {
      ctx.fillStyle = INK;
      ctx.font = `900 ${uSize}px ${FONT}`;
      ctx.fillText(unit, start + vW + W * 0.006, baseline);
    }
  }

  function drawDemoBadge(ctx, W, H) {
    const text = "演示样本 · 非真实订单";
    ctx.font = `800 ${Math.round(W * 0.018)}px ${FONT}`;
    const tw = ctx.measureText(text).width;
    const pad = W * 0.014, h = W * 0.034, x = W * 0.04, y = H * 0.025;
    roundRect(ctx, x, y, tw + pad * 2, h, h / 2);
    ctx.fillStyle = "rgba(21,21,21,.82)";
    ctx.fill();
    ctx.fillStyle = "#FFBC0D";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + pad, y + h / 2 + 1);
    ctx.textBaseline = "alphabetic";
  }

  async function renderPoster(canvas, { image, cards, demo }) {
    const img = await loadImage(image);
    const W = img.naturalWidth, H = img.naturalHeight;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, W, H);
    cards.forEach((card, i) => drawCard(ctx, W, H, i, card));
    if (demo) drawDemoBadge(ctx, W, H);
    return canvas;
  }

  root.MCDPoster = { renderPoster, CARD_X, CARD_Y };
})(typeof self !== "undefined" ? self : this);
