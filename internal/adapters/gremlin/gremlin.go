package gremlin

import (
	"crypto/tls"
	"errors"
	"fmt"
	"strings"

	"gremlin-viewer/internal/adapters/gremlin/parser"
	"gremlin-viewer/internal/core/domain"

	gremlingo "github.com/apache/tinkerpop/gremlin-go/v3/driver"
)

// Repository implements ports.GraphRepository using gremlin-go.
type Repository struct {
	conn *gremlingo.DriverRemoteConnection
	g    *gremlingo.GraphTraversalSource
}

// NewRepository creates a new Gremlin Repository.
func NewRepository() *Repository {
	return &Repository{}
}

// Connect establishes a WebSocket connection to the Gremlin Server.
func (r *Repository) Connect(url string) error {
	conn, err := gremlingo.NewDriverRemoteConnection(url,
		func(settings *gremlingo.DriverRemoteConnectionSettings) {
			settings.TlsConfig = &tls.Config{InsecureSkipVerify: true}
		})
	if err != nil {
		return fmt.Errorf("failed to connect to %s: %w", url, err)
	}
	r.conn = conn
	r.g = gremlingo.Traversal_().With(conn)
	return nil
}

// Close closes the connection to the Gremlin Server.
func (r *Repository) Close() error {
	if r.conn != nil {
		r.conn.Close()
		r.conn = nil
		r.g = nil
	}
	return nil
}

// ListLabels returns all unique vertex labels in the graph.
func (r *Repository) ListLabels() ([]string, error) {
	if r.g == nil {
		return nil, errors.New("not connected to a Gremlin Server")
	}

	results, err := r.g.V().Label().Dedup().ToList()
	if err != nil {
		return nil, fmt.Errorf("failed to list labels: %w", err)
	}

	labels := make([]string, 0, len(results))
	for _, result := range results {
		labels = append(labels, result.GetString())
	}
	return labels, nil
}

const pageSize = 100

// GetVerticesByLabel returns a page of vertices with the given label.
func (r *Repository) GetVerticesByLabel(label string, offset int, filterKey string, filterValue string) (domain.VertexPage, error) {
	if r.g == nil {
		return domain.VertexPage{}, errors.New("not connected to a Gremlin Server")
	}

	traversal := r.g.V().HasLabel(label)
	if filterKey != "" && filterValue != "" {
		switch filterKey {
		case "ID":
			traversal = traversal.HasId(filterValue)
		default:
			traversal = traversal.Has(filterKey, gremlingo.TextP.Containing(filterValue))
		}
	}

	fetchLimit := int32(offset + pageSize + 1)
	results, err := traversal.Range(int32(offset), fetchLimit).ElementMap().ToList()
	if err != nil {
		return domain.VertexPage{}, fmt.Errorf("failed to get vertices for label '%s': %w", label, err)
	}

	hasMore := len(results) > pageSize
	if hasMore {
		results = results[:pageSize]
	}

	vertices := make([]domain.Vertex, 0, len(results))
	for _, result := range results {
		elemMap, ok := result.GetInterface().(map[interface{}]interface{})
		if !ok {
			continue
		}

		id := parser.ExtractMapField(elemMap, gremlingo.T.Id, parser.TId)
		lbl := parser.ExtractMapField(elemMap, gremlingo.T.Label, parser.TLabel)
		v := parser.Vertex(id, lbl, elemMap)
		vertices = append(vertices, v)
	}
	return domain.VertexPage{Vertices: vertices, HasMore: hasMore}, nil
}

// ExecuteQuery submits a raw Gremlin query string and returns the normalized results.
func (r *Repository) ExecuteQuery(query string) (interface{}, error) {
	if r.conn == nil {
		return nil, errors.New("not connected to a Gremlin Server")
	}

	resultSet, err := r.conn.Submit(query)
	if err != nil {
		return nil, fmt.Errorf("query execution failed: %w", err)
	}

	results, err := resultSet.All()
	if err != nil {
		return nil, fmt.Errorf("failed to read query results: %w", err)
	}

	normalized := make([]interface{}, 0, len(results))
	for _, result := range results {
		normalized = append(normalized, parser.NormalizeResult(result.GetInterface()))
	}
	return normalized, nil
}

const defaultGraphQuery = "g.V().outE().inV().path().by(elementMap()).limit(100)"

func (r *Repository) GetGraphPaths(query string) ([]domain.GraphPath, error) {
	if r.conn == nil {
		return nil, errors.New("not connected to a Gremlin Server")
	}
	if strings.TrimSpace(query) == "" {
		query = defaultGraphQuery
	}

	resultSet, err := r.conn.Submit(query)
	if err != nil {
		return nil, fmt.Errorf("graph path query failed: %w", err)
	}

	results, err := resultSet.All()
	if err != nil {
		return nil, fmt.Errorf("failed to read graph path results: %w", err)
	}

	paths := make([]domain.GraphPath, 0, len(results))
	for _, result := range results {
		val := result.GetInterface()
		p, ok := val.(*gremlingo.Path)
		if !ok {
			continue
		}
		gp := domain.GraphPath{
			Objects: make([]interface{}, 0, len(p.Objects)),
		}
		for _, obj := range p.Objects {
			parsed := parser.PathObject(obj)
			if parsed != nil {
				gp.Objects = append(gp.Objects, parsed)
			}
		}
		paths = append(paths, gp)
	}
	return paths, nil
}

// GetVertexRelationships returns paginated relationships (edges + adjacent nodes) for a vertex.
func (r *Repository) GetVertexRelationships(vertexId string, limit int, offset int) ([]domain.Relationship, error) {
	if r.conn == nil {
		return nil, errors.New("not connected to a Gremlin Server")
	}

	end := offset + limit
	query := fmt.Sprintf(
		`g.V('%s').union(`+
			`outE().as('e').inV().as('v').project('dir','edge','target').by(constant('OUT')).by(select('e').elementMap()).by(select('v').elementMap()),`+
			`inE().as('e').outV().as('v').project('dir','edge','target').by(constant('IN')).by(select('e').elementMap()).by(select('v').elementMap())`+
			`).range(%d,%d)`,
		vertexId, offset, end,
	)

	resultSet, err := r.conn.Submit(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get relationships for vertex '%s': %w", vertexId, err)
	}

	results, err := resultSet.All()
	if err != nil {
		return nil, fmt.Errorf("failed to read relationship results: %w", err)
	}

	relationships := make([]domain.Relationship, 0, len(results))
	for _, result := range results {
		raw := result.GetInterface()
		row, ok := raw.(map[interface{}]interface{})
		if !ok {
			continue
		}

		direction := fmt.Sprintf("%v", row["dir"])

		edgeLabel := ""
		if edgeMap, ok := row["edge"].(map[interface{}]interface{}); ok {
			edgeLabel = parser.ExtractMapField(edgeMap, gremlingo.T.Label, parser.TLabel)
		}

		targetID := ""
		targetLabel := ""
		if targetMap, ok := row["target"].(map[interface{}]interface{}); ok {
			targetID = parser.ExtractMapField(targetMap, gremlingo.T.Id, parser.TId)
			targetLabel = parser.ExtractMapField(targetMap, gremlingo.T.Label, parser.TLabel)
		}

		relationships = append(relationships, domain.Relationship{
			Direction:   direction,
			EdgeLabel:   edgeLabel,
			TargetLabel: targetLabel,
			TargetID:    targetID,
		})
	}

	return relationships, nil
}
