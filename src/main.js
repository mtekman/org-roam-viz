import { Network, DataSet } from 'vis-network/standalone';

import Json2Graph from './json2graph.ts';
import TagLegend from './tag_legend.ts';
import TagColors from './tag_colors.ts';
import NetworkEvents from './network_events.ts';
import { network_options } from './network_options.ts';

async function loadJson(path) {
    const res = await fetch(path);
    if (!res.ok) {
        throw new Error(`Failed to load ${path}: ${res.status} ${res.statusText}`);
    }
    return res.json();
}

async function initNetwork() {
    const [rawNodes, rawEdges] = await Promise.all([
        loadJson('/nodes.json'),
        loadJson('/edges.json')
    ]);
    const nodesArray = Json2Graph.positionNodesByTopTags(rawNodes, 15);
    const [edgesArray, sharedEdgeNodes] = Json2Graph.mapEdges(rawEdges, 1);
    const sharedEdgeNodesArray = Json2Graph.processSharedEdgeNodes(
        sharedEdgeNodes, nodesArray);
    const newNodes = [...nodesArray, ...sharedEdgeNodesArray]
    
    const groups = TagColors.makeGroupColors(nodesArray);
    const container = document.getElementById('mynetwork');

    const nodes = new DataSet(newNodes);
    const edges = new DataSet(edgesArray);
    const data = { nodes, edges };

    NetworkEvents.initExtraNodes(nodesArray, nodes, edges);
    
    network_options["groups"] = groups;
    const network = new Network(container, data, network_options);
    TagLegend.init(nodes, 'legend-items', groups);
    // Counter to generate unique IDs for new nodes/edges
    network.on('click', function(graph_data){
        NetworkEvents.expandSingleNodes(graph_data, network, nodes)
    })
}

initNetwork().catch(err => {
    console.error(err);
    document.body.insertAdjacentHTML(
        'beforeend',
        `<div style="padding:1rem;color:red;">Error: ${err.message}</div>`
    );
});
