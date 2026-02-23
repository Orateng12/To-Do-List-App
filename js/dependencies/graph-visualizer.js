/**
 * Dependency Graph Visualizer
 * ===========================
 * Interactive DAG visualization for task dependencies
 *
 * Features:
 * - Force-directed graph layout
 * - Interactive nodes (drag, click, hover)
 * - Dependency edge visualization
 * - Critical path highlighting
 * - Zoom and pan
 * - Minimap
 */

import { eventBus, AppEvents } from '../core/event-bus.js';

class DependencyGraphVisualizer {
    constructor(container, dependencyManager) {
        this.container = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
        this.dependencyManager = dependencyManager;
        
        this.canvas = null;
        this.ctx = null;
        this.nodes = [];
        this.edges = [];
        this.animationFrame = null;
        
        // View state
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.selectedNode = null;
        this.hoveredNode = null;
        this.draggedNode = null;
        
        // Configuration
        this.config = {
            nodeRadius: 40,
            nodeMinRadius: 25,
            nodeMaxRadius: 60,
            edgeWidth: 2,
            edgeColor: '#666',
            edgeColorBlocking: '#ef4444',
            nodeColorDefault: '#6366f1',
            nodeColorCompleted: '#22c55e',
            nodeColorBlocked: '#ef4444',
            nodeColorCanStart: '#f59e0b',
            criticalPathColor: '#f59e0b',
            fontSize: 12,
            repulsion: 500,
            springLength: 150,
            springStrength: 0.1,
            damping: 0.9
        };
    }

    /**
     * Initialize the graph
     * @param {Array} tasks - Tasks to visualize
     * @returns {Promise<void>}
     */
    async init(tasks) {
        this._createCanvas();
        this._bindEvents();
        await this.loadData(tasks);
        this._startAnimation();
    }

    /**
     * Load task data into the graph
     * @param {Array} tasks - Tasks
     */
    async loadData(tasks) {
        const graphData = await this.dependencyManager.getGraphData(tasks);
        this.nodes = graphData.nodes.map(n => ({
            ...n,
            x: Math.random() * 400 + 100,
            y: Math.random() * 400 + 100,
            vx: 0,
            vy: 0,
            radius: this.config.nodeRadius
        }));
        this.edges = graphData.edges;
        
        this._calculateCriticalPath();
    }

    /**
     * Refresh graph data
     * @param {Array} tasks - New tasks
     */
    async refresh(tasks) {
        await this.loadData(tasks);
    }

    /**
     * Destroy the graph
     */
    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        if (this.canvas) {
            this.canvas.remove();
        }
    }

    // ==================== Private Methods ====================

    _createCanvas() {
        if (!this.container) return;

        this.container.innerHTML = '';
        
        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'dependency-graph-canvas';
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.container.clientHeight;
        this.ctx = this.canvas.getContext('2d');
        
        // Create UI controls
        const controls = this._createControls();
        
        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'dependency-graph-tooltip';
        tooltip.id = 'graphTooltip';
        
        this.container.appendChild(this.canvas);
        this.container.appendChild(controls);
        this.container.appendChild(tooltip);
        
        // Handle resize
        window.addEventListener('resize', () => {
            this.canvas.width = this.container.clientWidth;
            this.canvas.height = this.container.clientHeight;
            this._render();
        });
    }

    _createControls() {
        const controls = document.createElement('div');
        controls.className = 'dependency-graph-controls';
        controls.innerHTML = `
            <button class="graph-btn" data-action="zoom-in" title="Zoom In">+</button>
            <button class="graph-btn" data-action="zoom-out" title="Zoom Out">−</button>
            <button class="graph-btn" data-action="reset" title="Reset View">⟲</button>
            <button class="graph-btn" data-action="critical-path" title="Toggle Critical Path">⚡</button>
            <button class="graph-btn" data-action="layout" title="Re-layout">⬡</button>
        `;
        return controls;
    }

    _bindEvents() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this._handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this._handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this._handleMouseUp());
        this.canvas.addEventListener('wheel', (e) => this._handleWheel(e));
        this.canvas.addEventListener('dblclick', (e) => this._handleDoubleClick(e));
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this._handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this._handleTouchMove(e));
        this.canvas.addEventListener('touchend', () => this._handleMouseUp());
        
        // Control buttons
        this.container.addEventListener('click', (e) => {
            const btn = e.target.closest('.graph-btn');
            if (btn) {
                this._handleControlAction(btn.dataset.action);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!this.canvas) return;
            
            switch(e.key) {
                case '+':
                case '=':
                    this._handleControlAction('zoom-in');
                    break;
                case '-':
                    this._handleControlAction('zoom-out');
                    break;
                case '0':
                    this._handleControlAction('reset');
                    break;
                case 'c':
                    this._handleControlAction('critical-path');
                    break;
                case 'l':
                    this._handleControlAction('layout');
                    break;
                case 'Escape':
                    this.selectedNode = null;
                    this._render();
                    break;
            }
        });
    }

    _handleMouseDown(e) {
        const pos = this._getMousePos(e);
        const clickedNode = this._getNodeAtPosition(pos.x, pos.y);
        
        if (e.button === 0) { // Left click
            if (clickedNode) {
                this.selectedNode = clickedNode;
                this.draggedNode = clickedNode;
                eventBus.emit(AppEvents.GRAPH_NODE_SELECTED, { node: clickedNode });
            } else {
                this.isDragging = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
            }
            this._render();
        } else if (e.button === 2) { // Right click
            e.preventDefault();
            if (clickedNode) {
                eventBus.emit(AppEvents.GRAPH_NODE_CONTEXT_MENU, { 
                    node: clickedNode, 
                    x: e.clientX, 
                    y: e.clientY 
                });
            }
        }
    }

    _handleMouseMove(e) {
        const pos = this._getMousePos(e);
        
        // Update hovered node
        this.hoveredNode = this._getNodeAtPosition(pos.x, pos.y);
        this.canvas.style.cursor = this.hoveredNode ? 'pointer' : 'default';
        
        // Update tooltip
        this._updateTooltip(pos);
        
        // Handle dragging
        if (this.draggedNode) {
            this.draggedNode.x = (pos.x - this.offsetX) / this.scale;
            this.draggedNode.y = (pos.y - this.offsetY) / this.scale;
            this._render();
        } else if (this.isDragging) {
            const dx = e.clientX - this.lastMouseX;
            const dy = e.clientY - this.lastMouseY;
            this.offsetX += dx;
            this.offsetY += dy;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this._render();
        }
    }

    _handleMouseUp() {
        this.isDragging = false;
        this.draggedNode = null;
    }

    _handleWheel(e) {
        e.preventDefault();
        
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.2, Math.min(3, this.scale * delta));
        
        // Zoom toward mouse position
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const scaleRatio = newScale / this.scale;
        this.offsetX = mouseX - (mouseX - this.offsetX) * scaleRatio;
        this.offsetY = mouseY - (mouseY - this.offsetY) * scaleRatio;
        this.scale = newScale;
        
        this._render();
    }

    _handleDoubleClick(e) {
        const pos = this._getMousePos(e);
        const clickedNode = this._getNodeAtPosition(pos.x, pos.y);
        
        if (clickedNode) {
            eventBus.emit(AppEvents.GRAPH_NODE_DOUBLE_CLICK, { node: clickedNode });
        }
    }

    _handleTouchStart(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const pos = this._getMousePos(touch);
            const clickedNode = this._getNodeAtPosition(pos.x, pos.y);
            
            if (clickedNode) {
                this.draggedNode = clickedNode;
            } else {
                this.isDragging = true;
                this.lastMouseX = touch.clientX;
                this.lastMouseY = touch.clientY;
            }
        }
    }

    _handleTouchMove(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            
            if (this.draggedNode) {
                const pos = this._getMousePos(touch);
                this.draggedNode.x = (pos.x - this.offsetX) / this.scale;
                this.draggedNode.y = (pos.y - this.offsetY) / this.scale;
                this._render();
            } else if (this.isDragging) {
                const dx = touch.clientX - this.lastMouseX;
                const dy = touch.clientY - this.lastMouseY;
                this.offsetX += dx;
                this.offsetY += dy;
                this.lastMouseX = touch.clientX;
                this.lastMouseY = touch.clientY;
                this._render();
            }
        }
    }

    _handleControlAction(action) {
        switch (action) {
            case 'zoom-in':
                this.scale = Math.min(3, this.scale * 1.2);
                this._render();
                break;
            case 'zoom-out':
                this.scale = Math.max(0.2, this.scale * 0.8);
                this._render();
                break;
            case 'reset':
                this.scale = 1;
                this.offsetX = 0;
                this.offsetY = 0;
                this._render();
                break;
            case 'critical-path':
                this.showCriticalPath = !this.showCriticalPath;
                this._render();
                break;
            case 'layout':
                this._applyForceLayout();
                break;
        }
    }

    _getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.offsetX) / this.scale,
            y: (e.clientY - rect.top - this.offsetY) / this.scale
        };
    }

    _getNodeAtPosition(x, y) {
        for (const node of this.nodes) {
            const dx = x - node.x;
            const dy = y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= node.radius) {
                return node;
            }
        }
        return null;
    }

    _updateTooltip(pos) {
        const tooltip = document.getElementById('graphTooltip');
        if (!tooltip) return;
        
        if (this.hoveredNode) {
            const node = this.hoveredNode;
            tooltip.innerHTML = `
                <strong>${node.label}</strong><br>
                <span class="status ${node.completed ? 'completed' : node.canStart ? 'can-start' : 'blocked'}">
                    ${node.completed ? '✓ Completed' : node.canStart ? '○ Can Start' : '⊗ Blocked'}
                </span><br>
                <small>Priority: ${node.priority} | Blocking: ${node.blockingCount}</small>
            `;
            tooltip.style.display = 'block';
            tooltip.style.left = (pos.x * this.scale + this.offsetX + 15) + 'px';
            tooltip.style.top = (pos.y * this.scale + this.offsetY + 15) + 'px';
        } else {
            tooltip.style.display = 'none';
        }
    }

    _calculateCriticalPath() {
        // Simple critical path calculation
        const criticalNodes = new Set();
        
        // Find end nodes (no dependents)
        const endNodes = this.nodes.filter(n => 
            !this.edges.some(e => e.from === n.id)
        );
        
        // Backtrack from end nodes
        const visited = new Set();
        const queue = [...endNodes];
        
        while (queue.length > 0) {
            const node = queue.shift();
            if (visited.has(node.id)) continue;
            visited.add(node.id);
            criticalNodes.add(node.id);
            
            // Find predecessors
            const predecessors = this.edges
                .filter(e => e.to === node.id)
                .map(e => this.nodes.find(n => n.id === e.from));
            
            queue.push(...predecessors.filter(p => p && !visited.has(p.id)));
        }
        
        this.criticalNodeIds = criticalNodes;
    }

    _applyForceLayout() {
        // Reset positions with some randomness
        this.nodes.forEach(node => {
            node.x = Math.random() * 300 + 150;
            node.y = Math.random() * 300 + 150;
            node.vx = 0;
            node.vy = 0;
        });
    }

    _startAnimation() {
        const animate = () => {
            this._updatePhysics();
            this._render();
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }

    _updatePhysics() {
        // Apply forces
        for (let i = 0; i < this.nodes.length; i++) {
            const nodeA = this.nodes[i];
            
            // Skip fixed nodes
            if (nodeA === this.draggedNode) continue;
            
            // Repulsion between all nodes
            for (let j = i + 1; j < this.nodes.length; j++) {
                const nodeB = this.nodes[j];
                if (nodeB === this.draggedNode) continue;
                
                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                
                if (distance < 300) {
                    const force = this.config.repulsion / (distance * distance);
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;
                    
                    nodeA.vx -= fx;
                    nodeA.vy -= fy;
                    nodeB.vx += fx;
                    nodeB.vy += fy;
                }
            }
        }
        
        // Spring forces along edges
        for (const edge of this.edges) {
            const from = this.nodes.find(n => n.id === edge.from);
            const to = this.nodes.find(n => n.id === edge.to);
            
            if (!from || !to || from === this.draggedNode || to === this.draggedNode) continue;
            
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            
            const force = (distance - this.config.springLength) * this.config.springStrength;
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            from.vx += fx;
            from.vy += fy;
            to.vx -= fx;
            to.vy -= fy;
        }
        
        // Apply velocity and damping
        for (const node of this.nodes) {
            if (node === this.draggedNode) continue;
            
            node.x += node.vx;
            node.y += node.vy;
            node.vx *= this.config.damping;
            node.vy *= this.config.damping;
            
            // Boundary constraints
            const margin = 50;
            const width = (this.canvas.width / this.scale) - margin * 2;
            const height = (this.canvas.height / this.scale) - margin * 2;
            
            node.x = Math.max(margin, Math.min(width, node.x));
            node.y = Math.max(margin, Math.min(height, node.y));
        }
    }

    _render() {
        if (!this.ctx) return;
        
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Apply transform
        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);
        
        // Draw grid
        this._drawGrid();
        
        // Draw edges
        this._drawEdges();
        
        // Draw nodes
        this._drawNodes();
        
        ctx.restore();
    }

    _drawGrid() {
        const ctx = this.ctx;
        const gridSize = 50;
        const width = this.canvas.width / this.scale;
        const height = this.canvas.height / this.scale;
        
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.1)';
        ctx.lineWidth = 1;
        
        for (let x = 0; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        for (let y = 0; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    _drawEdges() {
        const ctx = this.ctx;
        
        for (const edge of this.edges) {
            const from = this.nodes.find(n => n.id === edge.from);
            const to = this.nodes.find(n => n.id === edge.to);
            
            if (!from || !to) continue;
            
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            
            const isBlocking = edge.isBlocking;
            const isCritical = this.showCriticalPath && 
                (this.criticalNodeIds?.has(edge.from) || this.criticalNodeIds?.has(edge.to));
            
            ctx.strokeStyle = isCritical 
                ? this.config.criticalPathColor 
                : (isBlocking ? this.config.edgeColorBlocking : this.config.edgeColor);
            ctx.lineWidth = isCritical ? 3 : this.config.edgeWidth;
            ctx.setLineDash(isBlocking ? [] : [5, 5]);
            
            ctx.stroke();
            
            // Draw arrow
            this._drawArrow(ctx, from, to);
        }
        
        ctx.setLineDash([]);
    }

    _drawArrow(ctx, from, to) {
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const arrowLength = 15;
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        
        // Draw at midpoint
        ctx.beginPath();
        ctx.moveTo(
            midX - arrowLength * Math.cos(angle - Math.PI / 6),
            midY - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(midX, midY);
        ctx.lineTo(
            midX - arrowLength * Math.cos(angle + Math.PI / 6),
            midY - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
    }

    _drawNodes() {
        const ctx = this.ctx;
        
        for (const node of this.nodes) {
            const isHovered = node === this.hoveredNode;
            const isSelected = node === this.selectedNode;
            const isCritical = this.showCriticalPath && this.criticalNodeIds?.has(node.id);
            
            // Determine color
            let color;
            if (node.completed) {
                color = this.config.nodeColorCompleted;
            } else if (!node.canStart && node.blockingCount > 0) {
                color = this.config.nodeColorBlocked;
            } else if (node.canStart) {
                color = this.config.nodeColorCanStart;
            } else {
                color = this.config.nodeColorDefault;
            }
            
            if (isCritical) {
                color = this.config.criticalPathColor;
            }
            
            // Draw node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            
            // Fill
            ctx.fillStyle = color;
            ctx.fill();
            
            // Stroke
            ctx.lineWidth = isSelected ? 4 : (isHovered ? 3 : 2);
            ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
            ctx.stroke();
            
            // Draw icon/text
            ctx.fillStyle = '#ffffff';
            ctx.font = `${this.config.fontSize}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const icon = node.completed ? '✓' : (node.blockingCount > 0 ? '⊗' : '○');
            ctx.fillText(icon, node.x, node.y - 6);
            
            // Draw label
            ctx.fillStyle = this.config.nodeColorDefault;
            ctx.font = `10px Inter, sans-serif`;
            const label = node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label;
            ctx.fillText(label, node.x, node.y + node.radius + 15);
        }
    }
}

// Additional events
AppEvents.GRAPH_NODE_SELECTED = 'graph:node_selected';
AppEvents.GRAPH_NODE_CONTEXT_MENU = 'graph:node_context_menu';
AppEvents.GRAPH_NODE_DOUBLE_CLICK = 'graph:node_dblclick';

export { DependencyGraphVisualizer };
