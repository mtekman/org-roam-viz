
export default class TagColors {

  public static generateDistinctColors(n) {
    const colors = [];
    for (let i = 0; i < n; i++) {
      // Use HSL to get evenly spaced, distinct hues
      const hue = Math.round((360 / n) * i);
      const color = `hsl(${hue}, 70%, 60%)`;
      colors.push(color);
    }
    return colors;
  }

  public static adjustColorBrightness(hsl, percent) {
    // hsl is like "hsl(120, 70%, 60%)"; adjust lightness
    const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) return hsl;
    const [, h, s, l] = match;
    const newL = Math.max(0, Math.min(100, parseInt(l, 10) + percent));
    return `hsl(${h}, ${s}%, ${newL}%)`;
  }

  public static makeGroupColors(tags) : Groups {
    const colors = TagColors.generateDistinctColors(tags.length);
    const groups = {
      default: {
        color: { background: '#d3d3d3', border: '#666666' }
      }
      // We insert more here
    };
    tags.forEach((tag, i) => {
      const baseColor = colors[i]; // hsl(...)
      groups[`tag:${tag}`] = {
        color: {
          background: baseColor,
          border: TagColors.adjustColorBrightness(baseColor, -20) // slightly darker border
        }
      };
    });
    return(groups);
  }
}