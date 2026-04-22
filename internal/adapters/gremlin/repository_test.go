package gremlin

import (
	"gremlin-viewer/internal/core/ports"
	"testing"
)

var _ ports.GraphRepository = (*Repository)(nil)

func TestNewRepository(t *testing.T) {
	repo := NewRepository()
	if repo == nil {
		t.Fatal("expected non-nil Repository")
	}
}

func TestConnect_InvalidURL(t *testing.T) {
	repo := NewRepository()
	err := repo.Connect("ws://invalid-host-that-does-not-exist:9999/gremlin")
	if err == nil {
		t.Fatal("expected error for invalid URL, got nil")
	}
}

func TestClose_WithoutConnect(t *testing.T) {
	repo := NewRepository()
	err := repo.Close()
	if err != nil {
		t.Fatalf("expected no error closing unconnected repo, got %v", err)
	}
}

func TestClose_AfterFailedConnect(t *testing.T) {
	repo := NewRepository()
	_ = repo.Connect("ws://invalid:9999/gremlin")
	err := repo.Close()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestListLabels_NotConnected(t *testing.T) {
	repo := NewRepository()
	_, err := repo.ListLabels()
	if err == nil {
		t.Fatal("expected error when not connected, got nil")
	}
}

func TestGetVerticesByLabel_NotConnected(t *testing.T) {
	repo := NewRepository()
	_, err := repo.GetVerticesByLabel("person", 0, "", "")
	if err == nil {
		t.Fatal("expected error when not connected, got nil")
	}
}

func TestExecuteQuery_NotConnected(t *testing.T) {
	repo := NewRepository()
	_, err := repo.ExecuteQuery("g.V()")
	if err == nil {
		t.Fatal("expected error when not connected, got nil")
	}
}

func TestGetGraphPaths_NotConnected(t *testing.T) {
	repo := NewRepository()
	_, err := repo.GetGraphPaths("g.V().path()")
	if err == nil {
		t.Fatal("expected error when not connected, got nil")
	}
}

func TestGetVertexRelationships_NotConnected(t *testing.T) {
	repo := NewRepository()
	_, err := repo.GetVertexRelationships("some-vertex-id", 10, 0)
	if err == nil {
		t.Fatal("expected error when not connected, got nil")
	}
	expected := "not connected to a Gremlin Server"
	if err.Error() != expected {
		t.Fatalf("expected error %q, got %q", expected, err.Error())
	}
}
