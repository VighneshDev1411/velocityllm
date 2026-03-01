package database

import (
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type VectorRepository struct {
	db *gorm.DB
}

func NewVectorRepository() *VectorRepository {
	return &VectorRepository{db: DB}
}

// ── Semantic Search ──────────────────────────────────────────────────────────

// GetAllChunksForSearch loads all chunks with embeddings, optionally filtered by collection
func (r *VectorRepository) GetAllChunksForSearch(collectionID *uuid.UUID, limit int) ([]types.Chunk, error) {
	if limit <= 0 {
		limit = 500
	}

	query := r.db.Where("embedding IS NOT NULL AND embedding != ''")

	if collectionID != nil {
		// Join through collection_documents to filter by collection
		query = query.Where("document_id IN (?)",
			r.db.Table("collection_documents").
				Select("document_id").
				Where("collection_id = ?", *collectionID),
		)
	}

	var chunks []types.Chunk
	err := query.Limit(limit).Find(&chunks).Error
	return chunks, err
}

// GetChunkByID loads a single chunk by ID
func (r *VectorRepository) GetChunkByID(id uuid.UUID) (*types.Chunk, error) {
	var chunk types.Chunk
	err := r.db.First(&chunk, "id = ?", id).Error
	return &chunk, err
}

// GetAllChunksForProjection loads chunks for 2D projection, capped at limit
func (r *VectorRepository) GetAllChunksForProjection(collectionID *uuid.UUID, limit int) ([]types.Chunk, error) {
	if limit <= 0 || limit > 500 {
		limit = 500
	}

	query := r.db.Where("embedding IS NOT NULL AND embedding != ''")

	if collectionID != nil {
		query = query.Where("document_id IN (?)",
			r.db.Table("collection_documents").
				Select("document_id").
				Where("collection_id = ?", *collectionID),
		)
	}

	var chunks []types.Chunk
	err := query.Limit(limit).Find(&chunks).Error
	return chunks, err
}

// ── Collections ──────────────────────────────────────────────────────────────

func (r *VectorRepository) CreateCollection(c *types.Collection) error {
	return r.db.Create(c).Error
}

func (r *VectorRepository) ListCollections() ([]types.Collection, error) {
	var collections []types.Collection
	err := r.db.Preload("Documents", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, name, type, size, chunk_count, status")
	}).Order("created_at DESC").Find(&collections).Error
	return collections, err
}

func (r *VectorRepository) DeleteCollection(id uuid.UUID) error {
	// Remove join table entries first, then the collection
	r.db.Exec("DELETE FROM collection_documents WHERE collection_id = ?", id)
	return r.db.Where("id = ?", id).Delete(&types.Collection{}).Error
}

func (r *VectorRepository) AddDocumentToCollection(collectionID, documentID uuid.UUID) error {
	return r.db.Exec(
		"INSERT INTO collection_documents (collection_id, document_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
		collectionID, documentID,
	).Error
}

func (r *VectorRepository) RemoveDocumentFromCollection(collectionID, documentID uuid.UUID) error {
	return r.db.Exec(
		"DELETE FROM collection_documents WHERE collection_id = ? AND document_id = ?",
		collectionID, documentID,
	).Error
}

// ── Stats ────────────────────────────────────────────────────────────────────

func (r *VectorRepository) GetVectorStats() (map[string]interface{}, error) {
	var totalVectors, totalDocs, totalCollections int64

	r.db.Model(&types.Chunk{}).Where("embedding IS NOT NULL AND embedding != ''").Count(&totalVectors)
	r.db.Model(&types.Document{}).Where("status = ?", "ready").Count(&totalDocs)
	r.db.Model(&types.Collection{}).Count(&totalCollections)

	var avgTokens struct{ Val float64 }
	r.db.Model(&types.Chunk{}).
		Where("embedding IS NOT NULL AND embedding != ''").
		Select("COALESCE(AVG(token_count), 0) as val").Scan(&avgTokens)

	return map[string]interface{}{
		"total_vectors":     totalVectors,
		"total_documents":   totalDocs,
		"total_collections": totalCollections,
		"avg_token_count":   avgTokens.Val,
		"embedding_dim":     384,
	}, nil
}
