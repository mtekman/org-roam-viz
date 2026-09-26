// [[file:../../org-projects/brain/org_roam_d3_graph.org::*Generate force diagram][Generate force diagram:1]]
import { Network, DataSet } from 'vis-network/standalone';
import 'vis-network/styles/vis-network.css';

// Optional: define colors per edge type
const EDGE_TYPE_COLORS = {
    id: '#F00',
    file: '#F00', // 
    https: '#0F0', //
    http: '#0F0', //
    UNKNOWN: '#00F'
};

function buildTooltipFromNode(node) {
    const parts = [];

    if (node.title) {
        parts.push(`${escapeHtml(node.title)}`);
    }
    if (node.heading) {
        parts.push(`<em>${escapeHtml(node.heading)}</em>`);
    }

    const tags = node.tags || {};
    const areaTags = tags.area || [];
    const generalTags = tags.general || [];

    const allTags = [...areaTags, ...generalTags];
    if (allTags.length > 0) {
        parts.push(`Tags: ${allTags.map(escapeHtml).join(', ')}`);
    }

    if (parts.length === 0) return undefined;
    return parts.join('<br>');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function mapEdges(rawEdges) {
    return rawEdges.map((e, idx) => {
        const type = e.type || 'UNKNOWN';
        const baseColor = EDGE_TYPE_COLORS[type] || '#848484';
        if (e.outline){
            e.outline = e.outline.join(",");
        }
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

function mapNodes(rawNodes) {
    return rawNodes.map(n => {
        const tags = n.tags || {};
        const areaTags = tags.area || [];
        const generalTags = tags.general || [];
        const allTags = [...areaTags, ...generalTags];

        // Simple grouping: use first area tag or first general tag as group
        let group = 'default';
        if (areaTags.length > 0) {
            group = `area:${areaTags[0]}`;
        } else if (generalTags.length > 0) {
            group = `general:${generalTags[0]}`;
        }

        return {
            id: n.id,
            label: n.title || String(n.id), // what is shown on the node
            title: buildTooltipFromNode(n), // HTML tooltip
            // Normal nodes are visible initially
            hidden: false,
            group,
            nodeTags: allTags
        };
    });
}

function buildTagLegend(nodesDS, legendContainerId) {
  const legendItemsEl = document.getElementById('legend-items');
  if (!legendItemsEl) return;

  // Collect all unique tags and their frequencies
  const tagCounts = new Map(); // tag -> count

  for (const node of nodesDS.get()) {
    const tags = node.nodeTags || [];
    for (const t of tags) {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }
  }

  const allTags = Array.from(tagCounts.keys()).sort();

  // State: which tags are currently enabled
  const enabledTags = new Set(allTags); // start with all enabled

  function applyTagFilter() {
    const updates = [];

    for (const node of nodesDS.get()) {
      const tags = node.nodeTags || [];
      const visible =
        tags.length === 0 || // nodes without tags always visible
        tags.some(t => enabledTags.has(t));

      const hidden = !visible;
      if (node.hidden !== hidden) {
        updates.push({ id: node.id, hidden });
      }
    }

    if (updates.length > 0) {
      nodesDS.update(updates);
    }
  }

  // Create checkboxes with frequency
  for (const tag of allTags) {
    const count = tagCounts.get(tag) || 0;

    const row = document.createElement('div');
    row.style.marginBottom = '4px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `tag-${tag}`;
    checkbox.checked = true;

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        enabledTags.add(tag);
      } else {
        enabledTags.delete(tag);
      }
      applyTagFilter();
    });

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = `${tag} (${count})`; // tag + frequency
    label.style.marginLeft = '4px';
    label.style.cursor = 'pointer';

    row.appendChild(checkbox);
    row.appendChild(label);
    legendItemsEl.appendChild(row);
  }
}

function positionNodesByTopTags(rawNodes, topN = 10) {
  // 1. Count tag frequencies
  const tagCounts = new Map();

  for (const n of rawNodes) {
    const tags = n.tags || {};
    const areaTags = tags.area || [];
    const generalTags = tags.general || [];
    const allTags = [...areaTags, ...generalTags];

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
    const tags = n.tags || {};
    const areaTags = tags.area || [];
    const generalTags = tags.general || [];
    const allTags = [...areaTags, ...generalTags];

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
        title: buildTooltipFromNode(node),
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

async function loadJson(path) {
    const res = await fetch(path);
    if (!res.ok) {
        throw new Error(`Failed to load ${path}: ${res.status} ${res.statusText}`);
    }
    return res.json();
}

function populateExtraNodesFrom(node_id, nodes, edges) {
    const existingIds = new Set(
        nodes.map(node => String(node.id))
    );
    const edgesArray = edges.get(); // returns a plain array of edge objects
    //let edge_count = 0;
    let new_nodes = {}
    for (const edge of edgesArray) {
        let nodeId  = edge.from;
        let addNodeId = edge.to;
        if (nodeId == null || addNodeId == null) continue; // covers null and undefined
        if (nodeId === node_id) {
            let addNormalizedId = String(addNodeId);
            if (!existingIds.has(addNormalizedId)){
                new_nodes[addNormalizedId] = {
                    id: `${addNormalizedId}`,
                    // x y positions are updated on click later
                    fixed: { x: false, y: false },
                    label: addNormalizedId,
                    title: addNormalizedId,
                    color: {
                        background: '#d3d3f3',
                        border: '#666666',
                        highlight: {
                            background: '#eeeeee',
                            border: '#333333'
                        }
                    },
                    shape: 'triangle',
                    size: 10,
                    temporary: true, // your own flag; vis-network won't use it
                    parentNode : nodeId
                };
                edge.hidden = false; // show it
            }
        }
        
    }
    return(Object.values(new_nodes));
}

function generateDistinctColors(n) {
  const colors = [];
  for (let i = 0; i < n; i++) {
    // Use HSL to get evenly spaced, distinct hues
    const hue = Math.round((360 / n) * i);
    const color = `hsl(${hue}, 70%, 60%)`;
    colors.push(color);
  }
  return colors;
}

function adjustColorBrightness(hsl, percent) {
  // hsl is like "hsl(120, 70%, 60%)"; adjust lightness
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return hsl;
  const [, h, s, l] = match;
  const newL = Math.max(0, Math.min(100, parseInt(l, 10) + percent));
  return `hsl(${h}, ${s}%, ${newL}%)`;
}

async function initNetwork() {
    const [rawNodes, rawEdges] = await Promise.all([
        loadJson('/good_nodes_dedup.json'),
        loadJson('/good_edges_dedup.json')
    ]);

    //const nodesArray = mapNodes(rawNodes);
    const nodesArray = positionNodesByTopTags(rawNodes, 10);
    const edgesArray = mapEdges(rawEdges);

    // Start// Derive unique tag groups from nodesArray
    const tagSet = new Set();
    for (const node of nodesArray) {
        const g = node.group; // e.g. 'tag:@foo' or 'default'
        if (g && g !== 'default') {
            // strip 'tag:' prefix if you used it
            const tag = g.startsWith('tag:') ? g.slice(4) : g;
            tagSet.add(tag);
        }
    }

    const tags = Array.from(tagSet);
    const colors = generateDistinctColors(tags.length);

    const groups = {
        default: {
            color: { background: '#d3d3d3', border: '#666666' }
        }
    };

    tags.forEach((tag, i) => {
        const baseColor = colors[i]; // hsl(...)
        groups[`tag:${tag}`] = {
            color: {
                background: baseColor,
                border: adjustColorBrightness(baseColor, -20) // slightly darker border
            }
        };
    });
    //END
    
    const container = document.getElementById('mynetwork');

    const nodes = new DataSet(nodesArray);
    const edges = new DataSet(edgesArray);
    const data = { nodes, edges };

    var extra_nodes = {}
    for (let nd of nodesArray){
        let new_nds = populateExtraNodesFrom(nd.id, nodes, edges);
        extra_nodes[nd.id] = {clicked: false, data: new_nds}
        if (new_nds.length > 0){
            nd.label = String(new_nds.length);
            nd.size = 20 + (5 * Math.log(new_nds.length));
        }
    }
    const options = {
        nodes: {
            shape: 'dot',
            size: 20,
            font: { size: 14, color: '#000' },
            borderWidth: 2,
            shadow: true
        },
        edges: {
            width: 2,
            smooth: { type: 'continuous' },
            font: {
                size: 12,
                align: 'middle',
                background: 'rgba(255,255,255,0.8)',
                strokeWidth: 0,
                color: '#333'
            },
            shadow: true
        },
        groups,
        physics: {
            enabled: true,
            barnesHut: {
                gravitationalConstant: -2000,  // a bit weaker to preserve clusters
                centralGravity: 0.15,
                springLength: 120,
                springConstant: 0.04,
                damping: 0.09
            },
            stabilization: {
                enabled: true,
                iterations: 300
            }
        },
        interaction: {
            hover: true,
            tooltipDelay: 150,
            zoomView: true,
            dragNodes: true,
            dragView: true,
            navigationButtons: true,
            keyboard: true
        }
    };

    const network = new Network(container, data, options);
    buildTagLegend(nodes, 'legend-items');
    // Counter to generate unique IDs for new nodes/edges
    network.on('click', (params) => {
        if (!params.nodes || params.nodes.length === 0) return;

        const nodeId = params.nodes[0];
        const nodePosition = network.getPositions([nodeId])[nodeId];
        if (!nodePosition) return;

        const existingIds = new Set(nodes.map(node => String(node.id)));        
        extra_nodes[nodeId].clicked = !extra_nodes[nodeId].clicked;
        
        let newnodes_clicked = extra_nodes[nodeId].clicked;
        let newnodes_data = extra_nodes[nodeId].data;

        if (newnodes_clicked){
            let actual_new_nodes = newnodes_data.filter(x => !existingIds.has(x.id));
            //console.log(newnodes_data.length, actual_new_nodes.length);
            for (let nd of actual_new_nodes){
                nd.x = nodePosition.x
                nd.y = nodePosition.y
            }
            nodes.add(actual_new_nodes)
        } else {
            nodes.remove(newnodes_data)
        }
    });
    
}

initNetwork().catch(err => {
    console.error(err);
    document.body.insertAdjacentHTML(
        'beforeend',
        `<div style="padding:1rem;color:red;">Error: ${err.message}</div>`
    );
});
// Generate force diagram:1 ends here
