
export default class NodeHelper {  
  public static buildTooltipFromNode(node: NodeData): String {
    const parts = [];
    
    if (node.title) {
      parts.push(`${NodeHelper.escapeHtml(node.title)}`);
    }
    if (node.heading) {
      parts.push(`<em>${NodeHelper.escapeHtml(node.heading)}</em>`);
    }

    const tags = node.tags || {};
    const areaTags = tags.area || [];
    const generalTags = tags.general || [];

    const allTags = [...areaTags, ...generalTags];
    if (allTags.length > 0) {
      parts.push(`Tags: ${allTags.map(NodeHelper.escapeHtml).join(', ')}`);
    }

    if (parts.length === 0) return undefined;
    return parts.join('<br>');
  }

  public static escapeHtml(str: String): String {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}