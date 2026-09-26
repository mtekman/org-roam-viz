import { Network, DataSet } from 'vis-network/standalone';
import 'vis-network/styles/vis-network.css';

import Json2Graph from './json2graph.ts';
import TagLegend from './tag_legend.ts';
import TagColors from './tag_colors.ts';

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


async function initNetwork() {
    const [rawNodes, rawEdges] = await Promise.all([
        loadJson('/good_nodes_dedup.json'),
        loadJson('/good_edges_dedup.json')
    ]);

    //const nodesArray = mapNodes(rawNodes);
    const nodesArray = Json2Graph.positionNodesByTopTags(rawNodes, 10);
    const edgesArray = Json2Graph.mapEdges(rawEdges);

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
    const groups = TagColors.makeGroupColors(tags);
    
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
    TagLegend.init(nodes, 'legend-items', groups);
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
