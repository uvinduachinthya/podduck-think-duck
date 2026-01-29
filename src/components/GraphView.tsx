import React, { useEffect, useState, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useFileSystem } from '../context/FileSystemContext';
import { useTheme } from '../context/ThemeContext';

interface GraphNode {
    id: string;
    name: string;
    val: number; // Size based on connections
    color?: string;
}

interface GraphLink {
    source: string;
    target: string;
}

interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

export function GraphView({ onNodeClick, hideUnconnected = false }: { onNodeClick: (nodeId: string) => void; hideUnconnected?: boolean }) {
    const { files } = useFileSystem();
    const { theme } = useTheme();
    const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const graphRef = useRef<any>(null);

    // Update dimensions on resize
    useEffect(() => {
        const updateDimensions = () => {
             if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight
                });
            }
        };

        window.addEventListener('resize', updateDimensions);
        updateDimensions();
        
        // Small delay to ensure container is ready
        setTimeout(updateDimensions, 100);

        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // Build Graph Data
    useEffect(() => {
        let active = true;

        const buildGraph = async () => {
            if (!files.length) return;

            const nodes: GraphNode[] = [];
            const links: GraphLink[] = [];
            const nodeMap = new Map<string, GraphNode>();

            // 1. Create nodes for all files
            files.forEach(file => {
                const name = file.name.replace('.md', '');
                const node: GraphNode = {
                    id: name,
                    name: name,
                    val: 1, // Default size
                    color: theme === 'dark' ? '#a78bfa' : '#6d28d9' // Purple
                };
                nodes.push(node);
                nodeMap.set(name, node);
            });

            // 2. Read files and find links
            // chunk processing to avoid freezing UI? 
            // For now, simple loop. If slow, we can optimize.
            
            for (const file of files) {
                if (!active) return;
                try {
                    const f = await file.handle.getFile();
                    const text = await f.text();
                    
                    // Regex for wikilinks: [[Link]] or [[Link|Alias]]
                    const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
                    let match;
                    
                    const sourceId = file.name.replace('.md', '');

                    while ((match = regex.exec(text)) !== null) {
                        const targetId = match[1].trim();
                        
                        // Only add link if target exists (or create ghost node?)
                        // Roam/Obsidian creates ghost nodes. Let's do that potentially?
                        // For now, let's stick to existing files to keep it clean.
                        // Or maybe show ghost nodes but greyed out?
                        // Let's stick to existing nodes first.
                        
                        if (nodeMap.has(targetId)) {
                             links.push({
                                source: sourceId,
                                target: targetId
                            });
                        }
                    }

                } catch (e) {
                    console.error("Error reading file for graph:", file.name, e);
                }
            }
            
            // Calculate node values (centrality/indegree)
            const connectionCount = new Map<string, number>();
            links.forEach(link => {
                connectionCount.set(link.source, (connectionCount.get(link.source) || 0) + 1);
                connectionCount.set(link.target, (connectionCount.get(link.target) || 0) + 1);
            });
            
            // Filter nodes if needed
            let finalNodes = nodes;
            if (hideUnconnected) {
                finalNodes = nodes.filter(node => (connectionCount.get(node.id) || 0) > 0);
            }

            finalNodes.forEach(node => {
                const count = connectionCount.get(node.id) || 0;
                node.val = 1 + (Math.log(count + 1) * 2); // Logarithmic scaling
            });


            if (active) {
                setGraphData({ nodes: finalNodes, links });
            }
        };

        buildGraph();

        return () => { active = false; };
    }, [files, theme, hideUnconnected]);

    // Theme colors
    const bgColor = theme === 'dark' ? '#1e1e1e' : '#ffffff';
    const textColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
    const linkColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';

    return (
        <div 
            ref={containerRef} 
            style={{ 
                width: '100%', 
                height: '100%', 
                overflow: 'hidden',
                backgroundColor: 'var(--bg-primary)' // Matches app background
            }}
        >
            <ForceGraph2D
                ref={graphRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}
                nodeLabel="name"
                nodeColor="color"
                backgroundColor={bgColor}
                linkColor={() => linkColor}
                linkWidth={1}
                nodeRelSize={4} // Circle size relative to val
                
                // Text rendering
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const label = node.name;
                  const fontSize = 12/globalScale;
                  ctx.font = `${fontSize}px Sans-Serif`;
                  const textWidth = ctx.measureText(label).width;
                  const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding

                  // Draw Node
                  ctx.beginPath();
                  ctx.fillStyle = node.color || '#a78bfa';
                  
                  // Circle radius
                  const r = Math.sqrt(Math.max(0, node.val || 1)) * 4;
                  ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI, false);
                  ctx.fill();
                  
                  // Text only if zoomed in or hovered? 
                  // Let's always draw text below node
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'top'; // Draw below
                  ctx.fillStyle = textColor;
                  ctx.fillText(label, node.x!, node.y! + r + 1); 

                  // Interactive area
                  node.__bckgDimensions = bckgDimensions; // to re-use in nodePointerAreaPaint
                }}
                nodePointerAreaPaint={(node, color, ctx) => {
                    const r = Math.sqrt(Math.max(0, node.val || 1)) * 4;
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI, false);
                    ctx.fill();
                }}

                onNodeClick={(node) => {
                    if (node && node.id) {
                        // Center/Zoom or navigate?
                        // Let's navigate
                        onNodeClick(node.id);
                    }
                }}
                
                cooldownTicks={100} // Stop simulation after a while to save CPU
                onEngineStop={() => graphRef.current?.zoomToFit(400, 20)}
            />
        </div>
    );
}
