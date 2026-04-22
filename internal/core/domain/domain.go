package domain

// Vertex represents a node in the graph database.
type Vertex struct {
	ID         string
	Label      string
	Properties map[string]interface{}
}

// PropertyKeys returns the list of property key names for this vertex.
func (v Vertex) PropertyKeys() []string {
	keys := make([]string, 0, len(v.Properties))
	for k := range v.Properties {
		keys = append(keys, k)
	}
	return keys
}

// Edge represents a directed relationship in the graph database.
type Edge struct {
	ID         string
	Label      string
	InV        string
	InVLabel   string
	OutV       string
	OutVLabel  string
	Properties map[string]interface{}
}

// PropertyKeys returns the list of property key names for this edge.
func (e Edge) PropertyKeys() []string {
	keys := make([]string, 0, len(e.Properties))
	for k := range e.Properties {
		keys = append(keys, k)
	}
	return keys
}

// Relationship represents a single edge connecting a vertex to an adjacent node.
type Relationship struct {
	Direction   string // "OUT" or "IN"
	EdgeLabel   string // label of the edge
	TargetLabel string // label of the adjacent vertex
	TargetID    string // id of the adjacent vertex
}

// VertexPage holds a page of vertices and whether more pages exist.
type VertexPage struct {
	Vertices []Vertex
	HasMore  bool
}

// GraphPath represents a single path result from a Gremlin path query.
type GraphPath struct {
	Objects []interface{}
}

// GraphData is the flattened, deduplicated structure sent to the frontend.
type GraphData struct {
	Vertices []Vertex
	Edges    []Edge
}
