
export const network_options = {
  nodes: {
    shape: 'dot',
    size: 20,
    font: { size: 14, color: '#000' },
    borderWidth: 2,
    shadow: false
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
    shadow: false
  },
  // groups should be dynamically inserted here later
  physics: {
    enabled: true,
    barnesHut: {
      gravitationalConstant: -2000,  // a bit weaker to preserve clusters
      centralGravity: 0.15,
      springLength: 120,
      springConstant: 0.04,
      damping: 0.1
    },
    stabilization: {
      enabled: true,
      iterations: 300
    }
  },
  interaction: {
    hover: false,
    tooltipDelay: 150,
    zoomView: true,
    dragNodes: true,
    dragView: true,
    navigationButtons: false,
    keyboard: true
  }
};
