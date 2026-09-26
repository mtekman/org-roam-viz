
export default class NetworkEvents {

  public static extra_nodes = {}

  public static populateExtraNodesFrom(node_id, nodes, edges) {
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

  public static initExtraNodes(nodesArray, nodes, edges){
    for (let nd of nodesArray){
      let new_nds = NetworkEvents.populateExtraNodesFrom(nd.id, nodes, edges);
      NetworkEvents.extra_nodes[nd.id] = {clicked: false, data: new_nds}
      if (new_nds.length > 0){
        //nd.label = String(new_nds.length);
        nd.size = 20 + (10 * Math.log(new_nds.length));
      }
    }
  }

  public static expandSingleNodes(graph_data, network, nodes) {
    if (!graph_data.nodes || graph_data.nodes.length === 0) return;

    const nodeId = graph_data.nodes[0];
    //const network = this
    const nodePosition = network.getPositions([nodeId])[nodeId];
    if (!nodePosition) return;

    const existingIds = new Set(nodes.map(node => String(node.id)));        
    NetworkEvents.extra_nodes[nodeId].clicked = !NetworkEvents.extra_nodes[nodeId].clicked;
        
    let newnodes_clicked = NetworkEvents.extra_nodes[nodeId].clicked;
    let newnodes_data = NetworkEvents.extra_nodes[nodeId].data;

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
  }
}