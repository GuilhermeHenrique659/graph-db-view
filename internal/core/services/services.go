package services

import (
	"errors"
	"strings"

	"gremlin-viewer/internal/core/domain"
	"gremlin-viewer/internal/core/ports"
)

// GraphService orchestrates graph operations through a repository port.
type GraphService struct {
	repo ports.GraphRepository
}

// NewGraphService creates a new GraphService with the given repository.
func NewGraphService(repo ports.GraphRepository) *GraphService {
	return &GraphService{repo: repo}
}

// Connect establishes a connection to the graph database at the given URL.
func (s *GraphService) Connect(url string) error {
	return s.repo.Connect(url)
}

// Disconnect closes the connection to the graph database.
func (s *GraphService) Disconnect() error {
	return s.repo.Close()
}

// ListLabels returns all unique vertex labels in the graph.
func (s *GraphService) ListLabels() ([]string, error) {
	return s.repo.ListLabels()
}

// GetVerticesByLabel returns a page of vertices with the given label.
func (s *GraphService) GetVerticesByLabel(label string, offset int, filterKey string, filterValue string) (domain.VertexPage, error) {
	return s.repo.GetVerticesByLabel(label, offset, filterKey, filterValue)
}

func (s *GraphService) ExecuteQuery(query string) (interface{}, error) {
	if strings.TrimSpace(query) == "" {
		return nil, errors.New("query must not be empty")
	}
	return s.repo.ExecuteQuery(query)
}

const DefaultGraphQuery = "g.V().outE().inV().path().by(elementMap()).limit(100)"

func (s *GraphService) GetGraphData(query string) (*domain.GraphData, error) {
	if strings.TrimSpace(query) == "" {
		query = DefaultGraphQuery
	}
	paths, err := s.repo.GetGraphPaths(query)
	if err != nil {
		return nil, err
	}
	return flattenPaths(paths), nil
}

func flattenPaths(paths []domain.GraphPath) *domain.GraphData {
	vertexMap := make(map[string]domain.Vertex)
	edgeMap := make(map[string]domain.Edge)

	for _, p := range paths {
		for _, obj := range p.Objects {
			switch v := obj.(type) {
			case domain.Vertex:
				vertexMap[v.ID] = v
			case domain.Edge:
				edgeMap[v.ID] = v
			}
		}
	}

	vertices := make([]domain.Vertex, 0, len(vertexMap))
	for _, v := range vertexMap {
		vertices = append(vertices, v)
	}
	edges := make([]domain.Edge, 0, len(edgeMap))
	for _, e := range edgeMap {
		edges = append(edges, e)
	}

	return &domain.GraphData{Vertices: vertices, Edges: edges}
}

// GetVertexRelationships returns paginated relationships for a given vertex.
func (s *GraphService) GetVertexRelationships(vertexId string, limit int, offset int) ([]domain.Relationship, error) {
	if strings.TrimSpace(vertexId) == "" {
		return nil, errors.New("vertex ID must not be empty")
	}
	if limit <= 0 {
		limit = 5
	}
	if offset < 0 {
		offset = 0
	}
	return s.repo.GetVertexRelationships(vertexId, limit, offset)
}
