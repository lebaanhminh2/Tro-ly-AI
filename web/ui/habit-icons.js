// Icons for the approved habit prototype; keep the shared tower artwork untouched.
export function habitIcon(name) {
  const paths = {
    plus: 'M12 5v14M5 12h14',
    up: 'M12 20V4m-6 6 6-6 6 6',
    down: 'M12 4v16m-6-6 6 6 6-6',
    chevron: 'm9 5 7 7-7 7',
    check: 'm5 12 4 4 10-10',
    archive: 'M4 8h16v12H4zM3 4h18v4H3zM9 12h6',
    trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    edit: 'm16 3 5 5-12 12-5 1 1-5zM14 5l5 5',
    restore: 'M3 4v5h5M3 9a9 9 0 1 1 0 7',
    back: 'm14 6-6 6 6 6',
    journal: 'M5 3h14v18H5zM5 7H3M5 12H3M5 17H3M9 8h6M9 12h6M9 16h4',
    leaf: 'M20 4C8 2 2 8 5 16c8 5 15-1 15-12ZM5 20l10-11',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  if (name === 'more') {
    for (const x of [5, 12, 19]) {
      const circle = document.createElementNS(svg.namespaceURI, 'circle');
      circle.setAttribute('cx', String(x));
      circle.setAttribute('cy', '12');
      circle.setAttribute('r', '1.6');
      circle.setAttribute('fill', 'currentColor');
      circle.setAttribute('stroke', 'none');
      svg.append(circle);
    }
  } else {
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', paths[name] ?? paths.leaf);
    svg.append(path);
  }
  return svg;
}
