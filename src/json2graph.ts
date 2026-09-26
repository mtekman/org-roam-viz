
const EDGE_TYPE_COLORS = {
  id: '#F00',
  file: '#F00', // 
  https: '#0F0', //
  http: '#0F0', //
  UNKNOWN: '#00F'
};

import NodeHelper from './node_helper.ts';

export default class Json2Graph {

  public static mapEdges(rawEdges) {
    return rawEdges.map((e, idx) => {
      const type = e.type || 'UNKNOWN';
      const baseColor = EDGE_TYPE_COLORS[type] || '#848484';
      const hidden = !(type==="id" || type==="file")
      const edge = {
        // Always unique, so duplicates are allowed
        id: e.id ?? `edge_${idx}`,
        from: e.source,
        to: e.dest,
        label: type,                 // shows on the edge
        color: baseColor,            // simple string, fully supported
        highlight: baseColor,        // separate field for highlight
        hidden: hidden,              // All id links
        title: e.outline || undefined // tooltip on hover
      };

      return edge;
    });
  }

  public static mapNodes(rawNodes) {
    return rawNodes.map(n => {
      const tags = n.tags || [];
      const allTags = [...tags];

      // Simple grouping: use first area tag or first general tag as group
      let group = 'default';
      if (allTags.length > 0) {
        group = tags[0];
      }

      return {
        id: n.id,
        label: n.title || String(n.id), // what is shown on the node
        title: NodeHelper.buildTooltipFromNode(n), // HTML tooltip
        // Normal nodes are visible initially
        hidden: false,
        group,
        nodeTags: allTags
      };
    });
  }

  public static positionNodesByTopTags(rawNodes, topN = 10) {
    // 1. Count tag frequencies
    const tagCounts = new Map();

    for (const n of rawNodes) {
      const tags = n.tags || [];
      const allTags = [...tags];
      for (const t of allTags) {
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
    }

    // 2. Sort tags by frequency, take top N
    const sortedTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([tag]) => tag);

    const topTagSet = new Set(sortedTags);

    // 3. Assign each node to a primary cluster:
    //    - if it has any of the top tags, use the first matching top tag
    //    - else put it in "other"
    const byTag = new Map(); // tag -> array of node records
    for (const tag of sortedTags) {
      byTag.set(tag, []);
    }
    byTag.set('other', []);

    for (const n of rawNodes) {
      const allTags = n.tags || [];

      let primary = 'other';
      for (const t of allTags) {
        if (topTagSet.has(t)) {
          primary = t;
          break;
        }
      }
      
      byTag.get(primary).push({
        ...n,
        _primaryTag: primary,
        _allTags: allTags
      });
    }

    // 4. Lay out clusters on a big circle, nodes within each cluster on a small circle
    const result = [];
    const clusterTags = [...sortedTags, 'other'];

    const clusterSpacing = 800;   // distance between cluster centers
    const clusterRadius = 250;    // radius of each cluster

    clusterTags.forEach((tag, tIndex) => {
      const nodesInTag = byTag.get(tag);
      const count = nodesInTag.length;
      if (count === 0) return;

      // Cluster center on a large circle
      const angle = (tIndex / clusterTags.length) * 2 * Math.PI;
      const cx = clusterSpacing * Math.cos(angle);
      const cy = clusterSpacing * Math.sin(angle);

      // Nodes in a smaller circle around cluster center
      nodesInTag.forEach((node, i) => {
        const a = count === 1 ? 0 : (i / count) * 2 * Math.PI;
        const r = clusterRadius * 0.8;

        result.push({
          id: node.id,
          label: node.title || String(node.id),
          title: NodeHelper.buildTooltipFromNode(node),
          group: tag === 'other' ? 'default' : `tag:${tag}`,
          nodeTags: node._allTags,
          x: cx + r * Math.cos(a),
          y: cy + r * Math.sin(a),
          fixed: { x: false, y: false }
        });
      });
    });

    return result;
  }
}