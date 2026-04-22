export function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, c => map[c]);
}

export function filterLabels(labels, filter) {
    if (!filter) return labels;
    const lower = filter.toLowerCase();
    return labels.filter(l => l.toLowerCase().includes(lower));
}

export function vertexToJson(vertex) {
    const obj = { ID: vertex.ID, Label: vertex.Label };
    if (vertex.Properties) {
        for (const [k, v] of Object.entries(vertex.Properties)) {
            obj[k] = v;
        }
    }
    return JSON.stringify(obj, null, 2);
}
