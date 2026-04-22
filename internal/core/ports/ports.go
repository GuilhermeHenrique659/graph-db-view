package ports

import "gremlin-viewer/internal/core/domain"

// GraphRepository defines the contract for interacting with a graph database.
type GraphRepository interface {
	Connect(url string) error
	Close() error
	ListLabels() ([]string, error)
	GetVerticesByLabel(label string, offset int, filterKey string, filterValue string) (domain.VertexPage, error)
	ExecuteQuery(query string) (interface{}, error)
	GetGraphPaths(query string) ([]domain.GraphPath, error)
	GetVertexRelationships(vertexId string, limit int, offset int) ([]domain.Relationship, error)
}
