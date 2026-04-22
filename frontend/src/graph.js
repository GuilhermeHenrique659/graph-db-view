const NS = 'http://www.w3.org/2000/svg';

const PALETTE = [
    '#5a9fd4', '#e57373', '#81c784', '#ffb74d', '#ba68c8',
    '#4dd0e1', '#fff176', '#f06292', '#a1887f', '#90a4ae',
];

function assignColors(nodes) {
    const map = new Map();
    const labels = [...new Set(nodes.map(n => n.label))];
    labels.forEach((label, i) => {
        map.set(label, PALETTE[i % PALETTE.length]);
    });
    return map;
}

function createSimulation(nodes, links, width, height, onTick) {
    const REPULSION = 3000;
    const SPRING_LENGTH = 100;
    const SPRING_STRENGTH = 0.01;
    const DAMPING = 0.75;
    const CENTER_STRENGTH = 0.02;
    const MIN_VELOCITY = 1.5;
    const MAX_TICKS = 120;

    let tickCount = 0;
    let running = true;
    let animationId = null;

    function tick() {
        if (!running) return;

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i], b = nodes[j];
                let dx = b.x - a.x;
                let dy = b.y - a.y;
                let dist = Math.sqrt(dx * dx + dy * dy) || 1;
                let force = REPULSION / (dist * dist);
                let fx = (dx / dist) * force;
                let fy = (dy / dist) * force;
                a.vx -= fx; a.vy -= fy;
                b.vx += fx; b.vy += fy;
            }
        }

        for (const link of links) {
            let dx = link.target.x - link.source.x;
            let dy = link.target.y - link.source.y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            let displacement = dist - SPRING_LENGTH;
            let force = SPRING_STRENGTH * displacement;
            let fx = (dx / dist) * force;
            let fy = (dy / dist) * force;
            link.source.vx += fx; link.source.vy += fy;
            link.target.vx -= fx; link.target.vy -= fy;
        }

        for (const node of nodes) {
            node.vx += (width / 2 - node.x) * CENTER_STRENGTH;
            node.vy += (height / 2 - node.y) * CENTER_STRENGTH;
        }

        let totalMovement = 0;
        for (const node of nodes) {
            if (node.fx !== null) { node.x = node.fx; node.y = node.fy; node.vx = 0; node.vy = 0; continue; }
            node.vx *= DAMPING;
            node.vy *= DAMPING;
            node.x += node.vx;
            node.y += node.vy;
            totalMovement += Math.abs(node.vx) + Math.abs(node.vy);
        }

        onTick();
        tickCount++;

        if (totalMovement < MIN_VELOCITY * nodes.length || tickCount > MAX_TICKS) {
            running = false;
            return;
        }

        animationId = requestAnimationFrame(tick);
    }

    animationId = requestAnimationFrame(tick);

    return {
        stop() { running = false; if (animationId) cancelAnimationFrame(animationId); },
        restart() { if (!running) { running = true; tickCount = 0; animationId = requestAnimationFrame(tick); } },
        isRunning() { return running; },
    };
}

function updatePositions(nodes, links) {
    for (const node of nodes) {
        node.el.setAttribute('transform', `translate(${node.x},${node.y})`);
    }
    for (const link of links) {
        link.el.setAttribute('x1', link.source.x);
        link.el.setAttribute('y1', link.source.y);
        link.el.setAttribute('x2', link.target.x);
        link.el.setAttribute('y2', link.target.y);
        link.labelEl.setAttribute('x', (link.source.x + link.target.x) / 2);
        link.labelEl.setAttribute('y', (link.source.y + link.target.y) / 2 - 6);
    }
}

function setupDrag(element, node, getSimulation) {
    let dragging = false;

    element.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        dragging = true;
        node.fx = node.x;
        node.fy = node.y;

        const onMove = (me) => {
            if (!dragging) return;
            const svg = element.closest('svg');
            const pt = svg.createSVGPoint();
            pt.x = me.clientX; pt.y = me.clientY;
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
            node.fx = svgP.x;
            node.fy = svgP.y;
            node.x = svgP.x;
            node.y = svgP.y;
            const sim = getSimulation();
            if (sim && !sim.isRunning()) sim.restart();
        };

        const onUp = () => {
            dragging = false;
            node.fx = null;
            node.fy = null;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

function setupPanZoom(svg, container, initialWidth, initialHeight) {
    let viewBox = { x: 0, y: 0, w: initialWidth, h: initialHeight };
    let isPanning = false;
    let startPoint = { x: 0, y: 0 };

    function updateViewBox() {
        svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    }

    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const scale = e.deltaY > 0 ? 1.1 : 0.9;
        const rect = svg.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width;
        const my = (e.clientY - rect.top) / rect.height;

        const newW = viewBox.w * scale;
        const newH = viewBox.h * scale;
        viewBox.x += (viewBox.w - newW) * mx;
        viewBox.y += (viewBox.h - newH) * my;
        viewBox.w = newW;
        viewBox.h = newH;
        updateViewBox();
    }, { passive: false });

    svg.addEventListener('mousedown', (e) => {
        if (e.target !== svg && e.target.parentNode !== svg) return;
        isPanning = true;
        startPoint = { x: e.clientX, y: e.clientY };
        svg.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        const dx = (e.clientX - startPoint.x) * (viewBox.w / svg.clientWidth);
        const dy = (e.clientY - startPoint.y) * (viewBox.h / svg.clientHeight);
        viewBox.x -= dx;
        viewBox.y -= dy;
        startPoint = { x: e.clientX, y: e.clientY };
        updateViewBox();
    });

    document.addEventListener('mouseup', () => {
        isPanning = false;
        svg.style.cursor = '';
    });
}

export function mountGraph(container, graphData, onSelectElement) {
    if (!container || !graphData) return null;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const nodeMap = new Map();
    const nodes = (graphData.Vertices || []).map(v => {
        const node = {
            id: v.ID, label: v.Label,
            x: Math.random() * width * 0.8 + width * 0.1,
            y: Math.random() * height * 0.8 + height * 0.1,
            vx: 0, vy: 0, fx: null, fy: null,
            domainData: v,
        };
        nodeMap.set(v.ID, node);
        return node;
    });

    const links = (graphData.Edges || [])
        .filter(e => nodeMap.has(e.OutV) && nodeMap.has(e.InV))
        .map(e => ({
            id: e.ID, label: e.Label,
            source: nodeMap.get(e.OutV),
            target: nodeMap.get(e.InV),
            domainData: e,
        }));

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `<marker id="arrowhead" viewBox="0 0 10 7" refX="24" refY="3.5"
        markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <polygon points="0 0, 10 3.5, 0 7" fill="#5a6a7a" />
    </marker>`;
    svg.appendChild(defs);

    const edgeGroup = document.createElementNS(NS, 'g');
    const nodeGroup = document.createElementNS(NS, 'g');
    svg.appendChild(edgeGroup);
    svg.appendChild(nodeGroup);

    const labelColors = assignColors(nodes);

    links.forEach(link => {
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('class', 'graph-edge');
        line.setAttribute('marker-end', 'url(#arrowhead)');
        line.addEventListener('click', (e) => {
            e.stopPropagation();
            onSelectElement({ type: 'edge', data: link.domainData });
        });
        link.el = line;
        edgeGroup.appendChild(line);

        const text = document.createElementNS(NS, 'text');
        text.setAttribute('class', 'graph-edge-label');
        text.textContent = link.label;
        link.labelEl = text;
        edgeGroup.appendChild(text);
    });

    nodes.forEach(node => {
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'graph-node');

        const circle = document.createElementNS(NS, 'circle');
        circle.setAttribute('r', '16');
        circle.setAttribute('fill', labelColors.get(node.label));

        const text = document.createElementNS(NS, 'text');
        text.setAttribute('class', 'graph-node-label');
        text.setAttribute('dy', '4');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = node.label.length > 8 ? node.label.slice(0, 7) + '\u2026' : node.label;

        g.appendChild(circle);
        g.appendChild(text);
        node.el = g;

        g.addEventListener('click', (e) => {
            e.stopPropagation();
            onSelectElement({ type: 'vertex', data: node.domainData });
        });

        nodeGroup.appendChild(g);
    });

    svg.addEventListener('click', () => onSelectElement(null));

    container.innerHTML = '';
    container.appendChild(svg);

    setupPanZoom(svg, container, width, height);

    let simulation = null;

    nodes.forEach(node => {
        setupDrag(node.el, node, () => simulation);
    });

    simulation = createSimulation(nodes, links, width, height, () => {
        updatePositions(nodes, links);
    });

    return { destroy: () => { if (simulation) simulation.stop(); } };
}
