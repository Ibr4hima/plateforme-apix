// ── Tooltip D3 : coordonnées viewport (le tooltip est en position:fixed) et
// repli automatique aux bords pour rester toujours visible à l'écran.
export function showD3Tooltip(tooltip: any, e: MouseEvent, html?: string) {
  if (html !== undefined) tooltip.html(html);
  tooltip.style("opacity", 1);
  const node = tooltip.node() as HTMLElement | null;
  const tw = node?.offsetWidth || 120, th = node?.offsetHeight || 44;
  let x = e.clientX + 14, y = e.clientY - th - 14;
  if (x + tw > window.innerWidth - 8) x = e.clientX - tw - 14;
  if (y < 8) y = e.clientY + 18;
  if (y + th > window.innerHeight - 8) y = window.innerHeight - th - 8;
  tooltip.style("left", x + "px").style("top", y + "px");
}
export function hideD3Tooltip(tooltip: any) { tooltip.style("opacity", 0); }
