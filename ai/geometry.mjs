export function rectRegion(rect, display) {
  const x0 = Math.min(rect.x, rect.x + rect.width), y0 = Math.min(rect.y, rect.y + rect.height);
  const x1 = Math.max(rect.x, rect.x + rect.width), y1 = Math.max(rect.y, rect.y + rect.height);
  const x = Math.round(x0), y = Math.round(y0);
  const width = Math.max(1, Math.round(x1 - x0)), height = Math.max(1, Math.round(y1 - y0));
  const left = Math.max(x, display.x), top = Math.max(y, display.y);
  const right = Math.min(x + width, display.x + display.width), bottom = Math.min(y + height, display.y + display.height);
  return {
    x, y, width, height,
    valid: { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) },
    padding: { left: left - x, top: top - y },
    scaleFactor: display.scaleFactor ?? 1,
  };
}

export function squareRegion(point, size, display) {
  return rectRegion({ x: point.x - size / 2, y: point.y - size / 2, width: size, height: size }, display);
}

export function anchoredPoint(target, bounds) {
  return { x: bounds.x + target.relative.x * bounds.width, y: bounds.y + target.relative.y * bounds.height };
}

export function windowAnchor(window, point) {
  return { ...window, relative: { x: (point.x - window.bounds.x) / window.bounds.width, y: (point.y - window.bounds.y) / window.bounds.height } };
}
