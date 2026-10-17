
export default class NodeHelper {  
  public static buildTooltipFromNode(node: NodeData): String {
    const parts = [];
    
    if (node.title) {
      parts.push(`${NodeHelper.escapeHtml(node.title)}`);
    }
    if (node.heading) {
      parts.push(`${NodeHelper.escapeHtml(node.heading)}`);
    }

    const allTags = node.tags || [];
    if (allTags.length > 0) {
      parts.push(`tags: ${allTags.map(NodeHelper.escapeHtml).join(', ')}`);
    }

    if (parts.length === 0) return undefined;
    return parts.join('\n');
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