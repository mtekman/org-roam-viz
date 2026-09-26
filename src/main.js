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

        // Simple grouping: use first area tag or first general tag as group
        let group = 'default';
        if (areaTags.length > 0) {
            group = `area:${areaTags[0]}`;
        } else if (generalTags.length > 0) {
            group = `general:${generalTags[0]}`;
        }

        const node = {
            id: n.id,
            label: n.title || String(n.id), // what is shown on the node
            title: buildTooltipFromNode(n), // HTML tooltip
            // Normal nodes are visible initially
            hidden: false,
            group
        };

        return node;
    });
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
                        background: '#d3d3d3',
                        border: '#666666',
                        highlight: {
                            background: '#eeeeee',
                            border: '#333333'
                        }
                    },
                    shape: 'dot',
                    size: 18,
                    temporary: true, // your own flag; vis-network won't use it
                    parentNode : nodeId
                };
                edge.hidden = false; // show it
            }
        }
        
    }
    return(Object.values(new_nodes));
}

async function initNetwork() {
    const [rawNodes, rawEdges] = await Promise.all([
        loadJson('/good_nodes_dedup.json'),
        loadJson('/good_edges_dedup.json')
    ]);

    const edgesArray = mapEdges(rawEdges);
    const nodesArray = mapNodes(rawNodes);
    const container = document.getElementById('mynetwork');

    const nodes = new DataSet(nodesArray);
    const edges = new DataSet(edgesArray);
    const data = { nodes, edges };

    var extra_nodes = {}
    for (let nd of nodesArray){
        let new_nds = populateExtraNodesFrom(nd.id, nodes, edges);
        extra_nodes[nd.id] = {clicked: false, data: new_nds}
    }
    //console.log(extra_nodes);

    // Optional: style per group (color, shape, etc.)
    const groups = {
        default: {
            color: { background: '#97c2fc', border: '#2b7ce9' },
            shape: 'dot'
        }
        // You can add more groups dynamically if you want specific colors per tag
    };
    const options = {
        nodes: {
            shape: 'dot',
            size: 20,
            font: {
                size: 14,
                color: '#000000'
            },
            borderWidth: 2,
            shadow: true
        },
        edges: {
            width: 2,
            smooth: {
                type: 'continuous'
            },
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
                gravitationalConstant: -3000,
                centralGravity: 0.3,
                springLength: 120,
                springConstant: 0.04,
                damping: 0.09
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
    // Counter to generate unique IDs for new nodes/edges
    let nextNodeId = 100000;
    let nextEdgeId = 100000;

    network.on('click', (params) => {
        if (!params.nodes || params.nodes.length === 0) return;

        const nodeId = params.nodes[0];
        const nodePosition = network.getPositions([nodeId])[nodeId];
        if (!nodePosition) return;

        extra_nodes[nodeId].clicked = !extra_nodes[nodeId].clicked;
        let newnodes_clicked = extra_nodes[nodeId].clicked;
        let newnodes_data = extra_nodes[nodeId].data;
        if (newnodes_clicked){
            for (let nd of newnodes_data){
                // update positions
                nd.x = nodePosition.x; nd.y = nodePosition.y;
            }
            nodes.add(newnodes_data)
        } else {
            nodes.remove(newnodes_data);
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
