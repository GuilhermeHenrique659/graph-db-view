package main

import (
	"context"

	"gremlin-viewer/internal/core/domain"
)

// graphService defines what the App needs from the service layer.
type graphService interface {
	Connect(url string) error
	Disconnect() error
	ListLabels() ([]string, error)
	GetVerticesByLabel(label string, offset int, filterKey string, filterValue string) (domain.VertexPage, error)
	ExecuteQuery(query string) (interface{}, error)
	GetGraphData(query string) (*domain.GraphData, error)
	GetVertexRelationships(vertexId string, limit int, offset int) ([]domain.Relationship, error)
}

// App struct holds the Wails application state.
type App struct {
	ctx     context.Context
	service graphService
}

// NewApp creates a new App with the given service.
func NewApp(service graphService) *App {
	return &App{service: service}
}

// startup is called when the Wails app starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// Connect connects to a Gremlin Server at the given URL.
func (a *App) Connect(url string) error {
	return a.service.Connect(url)
}

// ListLabels returns all vertex labels from the connected graph.
func (a *App) ListLabels() ([]string, error) {
	return a.service.ListLabels()
}

// GetVerticesByLabel returns a page of vertices with the given label.
func (a *App) GetVerticesByLabel(label string, offset int, filterKey string, filterValue string) (domain.VertexPage, error) {
	return a.service.GetVerticesByLabel(label, offset, filterKey, filterValue)
}

func (a *App) ExecuteQuery(query string) (interface{}, error) {
	return a.service.ExecuteQuery(query)
}

func (a *App) GetGraphData(query string) (*domain.GraphData, error) {
	return a.service.GetGraphData(query)
}

func (a *App) Disconnect() error {
	return a.service.Disconnect()
}

// GetVertexRelationships returns the relationships for a given vertex.
func (a *App) GetVertexRelationships(vertexId string, limit int, offset int) ([]domain.Relationship, error) {
	return a.service.GetVertexRelationships(vertexId, limit, offset)
}
