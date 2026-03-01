package database

import (
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RAGRepository struct {
	db *gorm.DB
}

func NewRAGRepository() *RAGRepository {
	return &RAGRepository{db: DB}
}

// ── Documents ────────────────────────────────────────────────────────────────

func (r *RAGRepository) CreateDocument(doc *types.Document) error {
	return r.db.Create(doc).Error
}

func (r *RAGRepository) GetDocument(id uuid.UUID) (*types.Document, error) {
	var doc types.Document
	err := r.db.First(&doc, "id = ?", id).Error
	return &doc, err
}

func (r *RAGRepository) GetDocumentWithChunks(id uuid.UUID) (*types.Document, error) {
	var doc types.Document
	err := r.db.Preload("Chunks", func(db *gorm.DB) *gorm.DB {
		return db.Order("\"index\" ASC")
	}).First(&doc, "id = ?", id).Error
	return &doc, err
}

func (r *RAGRepository) ListDocuments(limit, offset int) ([]types.Document, int64, error) {
	var docs []types.Document
	var total int64

	r.db.Model(&types.Document{}).Count(&total)
	err := r.db.Select("id, created_at, updated_at, name, type, size, chunk_count, status, error, user_id").
		Order("created_at DESC").Limit(limit).Offset(offset).Find(&docs).Error
	return docs, total, err
}

func (r *RAGRepository) UpdateDocumentStatus(id uuid.UUID, status string, chunkCount int, errMsg string) error {
	updates := map[string]interface{}{
		"status":      status,
		"chunk_count": chunkCount,
	}
	if errMsg != "" {
		updates["error"] = errMsg
	}
	return r.db.Model(&types.Document{}).Where("id = ?", id).Updates(updates).Error
}

func (r *RAGRepository) DeleteDocument(id uuid.UUID) error {
	// Chunks deleted via CASCADE
	return r.db.Where("id = ?", id).Delete(&types.Document{}).Error
}

// ── Chunks ───────────────────────────────────────────────────────────────────

func (r *RAGRepository) CreateChunks(chunks []types.Chunk) error {
	if len(chunks) == 0 {
		return nil
	}
	return r.db.CreateInBatches(chunks, 100).Error
}

func (r *RAGRepository) GetChunksByDocument(docID uuid.UUID) ([]types.Chunk, error) {
	var chunks []types.Chunk
	err := r.db.Where("document_id = ?", docID).Order("\"index\" ASC").Find(&chunks).Error
	return chunks, err
}

// GetAllChunksWithEmbeddings loads all chunks that have embeddings (for retrieval)
func (r *RAGRepository) GetAllChunksWithEmbeddings() ([]types.Chunk, error) {
	var chunks []types.Chunk
	err := r.db.Where("embedding IS NOT NULL AND embedding != ''").Find(&chunks).Error
	return chunks, err
}

// GetChunksForDocuments loads chunks for specific document IDs
func (r *RAGRepository) GetChunksForDocuments(docIDs []uuid.UUID) ([]types.Chunk, error) {
	var chunks []types.Chunk
	err := r.db.Where("document_id IN ? AND embedding IS NOT NULL AND embedding != ''", docIDs).Find(&chunks).Error
	return chunks, err
}

// ── Stats ────────────────────────────────────────────────────────────────────

func (r *RAGRepository) GetRAGStats() (map[string]interface{}, error) {
	var totalDocs, readyDocs, totalChunks int64

	r.db.Model(&types.Document{}).Count(&totalDocs)
	r.db.Model(&types.Document{}).Where("status = ?", "ready").Count(&readyDocs)
	r.db.Model(&types.Chunk{}).Count(&totalChunks)

	var totalSize struct{ Val int64 }
	r.db.Model(&types.Document{}).Select("COALESCE(SUM(size), 0) as val").Scan(&totalSize)

	return map[string]interface{}{
		"total_documents": totalDocs,
		"ready_documents": readyDocs,
		"total_chunks":    totalChunks,
		"total_size":      totalSize.Val,
	}, nil
}

// GetDocumentNames returns a map of doc ID → doc name for display
func (r *RAGRepository) GetDocumentNames(docIDs []uuid.UUID) (map[string]string, error) {
	var docs []types.Document
	err := r.db.Select("id, name").Where("id IN ?", docIDs).Find(&docs).Error
	if err != nil {
		return nil, err
	}
	names := make(map[string]string)
	for _, d := range docs {
		names[d.ID.String()] = d.Name
	}
	return names, nil
}
