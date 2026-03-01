package api

import (
	"encoding/json"
	"math"
	"math/rand"
	"net/http"
	"strings"

	"github.com/VighneshDev1411/velocityllm/internal/database"
	"github.com/VighneshDev1411/velocityllm/internal/rag"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/google/uuid"
)

// ── Semantic Search ──────────────────────────────────────────────────────────

type VectorSearchRequest struct {
	Query        string  `json:"query"`
	CollectionID string  `json:"collection_id,omitempty"`
	Limit        int     `json:"limit"`
}

// VectorSearchHandler POST /api/v1/vectors/search
func VectorSearchHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req VectorSearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Query == "" {
		types.WriteError(w, http.StatusBadRequest, "Query is required")
		return
	}
	if req.Limit <= 0 {
		req.Limit = 10
	}

	repo := database.NewVectorRepository()
	ragRepo := database.NewRAGRepository()
	engine := rag.NewEngine()

	var collectionID *uuid.UUID
	if req.CollectionID != "" {
		uid, err := uuid.Parse(req.CollectionID)
		if err != nil {
			types.WriteError(w, http.StatusBadRequest, "Invalid collection ID")
			return
		}
		collectionID = &uid
	}

	chunks, err := repo.GetAllChunksForSearch(collectionID, 1000)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to load chunks")
		return
	}
	if len(chunks) == 0 {
		types.WriteSuccess(w, "No vectors found", map[string]interface{}{
			"results": []interface{}{},
			"total":   0,
		})
		return
	}

	// Get doc names
	docIDSet := make(map[uuid.UUID]bool)
	for _, c := range chunks {
		docIDSet[c.DocumentID] = true
	}
	var docIDs []uuid.UUID
	for id := range docIDSet {
		docIDs = append(docIDs, id)
	}
	docNames, _ := ragRepo.GetDocumentNames(docIDs)

	queryEmbedding := engine.GenerateEmbedding(req.Query)

	candidates := make([]rag.RankedChunk, 0, len(chunks))
	for _, c := range chunks {
		emb, parseErr := rag.EmbeddingFromJSON(c.Embedding)
		if parseErr != nil {
			continue
		}
		candidates = append(candidates, rag.RankedChunk{
			Content:   c.Content,
			Index:     c.Index,
			DocID:     c.DocumentID.String(),
			DocName:   docNames[c.DocumentID.String()],
			Embedding: emb,
		})
	}

	// Score and sort
	for i := range candidates {
		candidates[i].Similarity = rag.CosineSimilarity(queryEmbedding, candidates[i].Embedding)
	}
	// Selection sort top N
	k := req.Limit
	if k > len(candidates) {
		k = len(candidates)
	}
	for i := 0; i < k; i++ {
		maxIdx := i
		for j := i + 1; j < len(candidates); j++ {
			if candidates[j].Similarity > candidates[maxIdx].Similarity {
				maxIdx = j
			}
		}
		candidates[i], candidates[maxIdx] = candidates[maxIdx], candidates[i]
	}

	results := make([]map[string]interface{}, k)
	for i := 0; i < k; i++ {
		results[i] = map[string]interface{}{
			"content":       candidates[i].Content,
			"chunk_index":   candidates[i].Index,
			"document_id":   candidates[i].DocID,
			"document_name": candidates[i].DocName,
			"similarity":    math.Round(candidates[i].Similarity*10000) / 10000,
		}
	}

	types.WriteSuccess(w, "Semantic search results", map[string]interface{}{
		"results":       results,
		"total_searched": len(candidates),
		"returned":      k,
		"query":         req.Query,
	})
}

// ── Nearest Neighbors ────────────────────────────────────────────────────────

type NearestNeighborsRequest struct {
	ChunkID string `json:"chunk_id"`
	Limit   int    `json:"limit"`
}

// VectorNearestNeighborsHandler POST /api/v1/vectors/neighbors
func VectorNearestNeighborsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req NearestNeighborsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.ChunkID == "" {
		types.WriteError(w, http.StatusBadRequest, "chunk_id is required")
		return
	}
	if req.Limit <= 0 {
		req.Limit = 5
	}

	chunkUUID, err := uuid.Parse(req.ChunkID)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid chunk_id")
		return
	}

	repo := database.NewVectorRepository()
	ragRepo := database.NewRAGRepository()

	targetChunk, err := repo.GetChunkByID(chunkUUID)
	if err != nil {
		types.WriteError(w, http.StatusNotFound, "Chunk not found")
		return
	}

	targetEmb, err := rag.EmbeddingFromJSON(targetChunk.Embedding)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Invalid embedding on target chunk")
		return
	}

	allChunks, err := repo.GetAllChunksForSearch(nil, 1000)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to load chunks")
		return
	}

	docIDSet := make(map[uuid.UUID]bool)
	for _, c := range allChunks {
		docIDSet[c.DocumentID] = true
	}
	var docIDs []uuid.UUID
	for id := range docIDSet {
		docIDs = append(docIDs, id)
	}
	docNames, _ := ragRepo.GetDocumentNames(docIDs)

	type scored struct {
		Content    string
		DocID      string
		DocName    string
		ChunkIndex int
		Similarity float64
	}

	var candidates []scored
	for _, c := range allChunks {
		if c.ID == chunkUUID {
			continue
		}
		emb, parseErr := rag.EmbeddingFromJSON(c.Embedding)
		if parseErr != nil {
			continue
		}
		sim := rag.CosineSimilarity(targetEmb, emb)
		candidates = append(candidates, scored{
			Content:    c.Content,
			DocID:      c.DocumentID.String(),
			DocName:    docNames[c.DocumentID.String()],
			ChunkIndex: c.Index,
			Similarity: sim,
		})
	}

	k := req.Limit
	if k > len(candidates) {
		k = len(candidates)
	}
	for i := 0; i < k; i++ {
		maxIdx := i
		for j := i + 1; j < len(candidates); j++ {
			if candidates[j].Similarity > candidates[maxIdx].Similarity {
				maxIdx = j
			}
		}
		candidates[i], candidates[maxIdx] = candidates[maxIdx], candidates[i]
	}

	results := make([]map[string]interface{}, k)
	for i := 0; i < k; i++ {
		results[i] = map[string]interface{}{
			"content":       candidates[i].Content,
			"document_id":   candidates[i].DocID,
			"document_name": candidates[i].DocName,
			"chunk_index":   candidates[i].ChunkIndex,
			"similarity":    math.Round(candidates[i].Similarity*10000) / 10000,
		}
	}

	types.WriteSuccess(w, "Nearest neighbors", map[string]interface{}{
		"source_chunk_id": req.ChunkID,
		"neighbors":       results,
	})
}

// ── 2D Projection ────────────────────────────────────────────────────────────

type ProjectionRequest struct {
	CollectionID string `json:"collection_id,omitempty"`
	Limit        int    `json:"limit"`
}

// VectorProjectionHandler POST /api/v1/vectors/projection
// Random projection: 384→2D using a deterministic seed(42) random matrix
func VectorProjectionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req ProjectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Limit <= 0 {
		req.Limit = 500
	}

	repo := database.NewVectorRepository()
	ragRepo := database.NewRAGRepository()

	var collectionID *uuid.UUID
	if req.CollectionID != "" {
		uid, err := uuid.Parse(req.CollectionID)
		if err != nil {
			types.WriteError(w, http.StatusBadRequest, "Invalid collection ID")
			return
		}
		collectionID = &uid
	}

	chunks, err := repo.GetAllChunksForProjection(collectionID, req.Limit)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to load chunks")
		return
	}

	// Get doc names for coloring
	docIDSet := make(map[uuid.UUID]bool)
	for _, c := range chunks {
		docIDSet[c.DocumentID] = true
	}
	var docIDs []uuid.UUID
	for id := range docIDSet {
		docIDs = append(docIDs, id)
	}
	docNames, _ := ragRepo.GetDocumentNames(docIDs)

	// Build deterministic random projection matrix [384 x 2]
	rng := rand.New(rand.NewSource(42))
	const dim = 384
	projMatrix := make([][]float64, dim)
	for i := 0; i < dim; i++ {
		projMatrix[i] = []float64{rng.NormFloat64(), rng.NormFloat64()}
	}

	type point struct {
		X           float64 `json:"x"`
		Y           float64 `json:"y"`
		Content     string  `json:"content"`
		DocID       string  `json:"document_id"`
		DocName     string  `json:"document_name"`
		ChunkIndex  int     `json:"chunk_index"`
	}

	points := make([]point, 0, len(chunks))
	var minX, minY, maxX, maxY float64
	minX, minY = math.MaxFloat64, math.MaxFloat64
	maxX, maxY = -math.MaxFloat64, -math.MaxFloat64

	rawPoints := make([][2]float64, 0, len(chunks))

	for _, c := range chunks {
		emb, parseErr := rag.EmbeddingFromJSON(c.Embedding)
		if parseErr != nil || len(emb) != dim {
			continue
		}

		// Project: dot product with each column
		var px, py float64
		for j := 0; j < dim; j++ {
			px += emb[j] * projMatrix[j][0]
			py += emb[j] * projMatrix[j][1]
		}

		rawPoints = append(rawPoints, [2]float64{px, py})
		if px < minX { minX = px }
		if py < minY { minY = py }
		if px > maxX { maxX = px }
		if py > maxY { maxY = py }

		preview := c.Content
		if len(preview) > 100 {
			preview = preview[:100] + "..."
		}

		points = append(points, point{
			Content:    preview,
			DocID:      c.DocumentID.String(),
			DocName:    docNames[c.DocumentID.String()],
			ChunkIndex: c.Index,
		})
	}

	// Normalize to [0, 1]
	rangeX := maxX - minX
	rangeY := maxY - minY
	if rangeX == 0 { rangeX = 1 }
	if rangeY == 0 { rangeY = 1 }

	for i := range points {
		points[i].X = math.Round(((rawPoints[i][0]-minX)/rangeX)*10000) / 10000
		points[i].Y = math.Round(((rawPoints[i][1]-minY)/rangeY)*10000) / 10000
	}

	types.WriteSuccess(w, "2D projection", map[string]interface{}{
		"points":      points,
		"total":       len(points),
		"method":      "random_projection",
		"source_dim":  dim,
		"target_dim":  2,
	})
}

// ── Stats ────────────────────────────────────────────────────────────────────

// VectorStatsHandler GET /api/v1/vectors/stats
func VectorStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	repo := database.NewVectorRepository()
	stats, err := repo.GetVectorStats()
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to get vector stats")
		return
	}

	// Build similarity distribution histogram
	// Sample pairwise similarities from first N chunks
	vecRepo := database.NewVectorRepository()
	chunks, _ := vecRepo.GetAllChunksForSearch(nil, 200)

	buckets := make([]int, 10) // [0.0-0.1, 0.1-0.2, ..., 0.9-1.0]
	sampleSize := len(chunks)
	if sampleSize > 100 {
		sampleSize = 100
	}

	embeddings := make([][]float64, 0, sampleSize)
	for i := 0; i < sampleSize; i++ {
		emb, err := rag.EmbeddingFromJSON(chunks[i].Embedding)
		if err == nil {
			embeddings = append(embeddings, emb)
		}
	}

	pairCount := 0
	for i := 0; i < len(embeddings); i++ {
		for j := i + 1; j < len(embeddings); j++ {
			sim := rag.CosineSimilarity(embeddings[i], embeddings[j])
			bucket := int(sim * 10)
			if bucket >= 10 {
				bucket = 9
			}
			if bucket < 0 {
				bucket = 0
			}
			buckets[bucket]++
			pairCount++
		}
	}

	labels := []string{"0-0.1", "0.1-0.2", "0.2-0.3", "0.3-0.4", "0.4-0.5", "0.5-0.6", "0.6-0.7", "0.7-0.8", "0.8-0.9", "0.9-1.0"}
	histogram := make([]map[string]interface{}, 10)
	for i := 0; i < 10; i++ {
		histogram[i] = map[string]interface{}{
			"range": []float64{float64(i) / 10.0, float64(i+1) / 10.0},
			"label": labels[i],
			"count": buckets[i],
		}
	}

	stats["similarity_histogram"] = histogram
	stats["pairs_sampled"] = pairCount

	types.WriteSuccess(w, "Vector stats", stats)
}

// ── Collections CRUD ─────────────────────────────────────────────────────────

type CreateCollectionRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
}

// ListCollectionsHandler GET /api/v1/vectors/collections
func ListCollectionsHandler(w http.ResponseWriter, r *http.Request) {
	repo := database.NewVectorRepository()
	collections, err := repo.ListCollections()
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to list collections")
		return
	}

	types.WriteSuccess(w, "Collections listed", map[string]interface{}{
		"collections": collections,
		"total":       len(collections),
	})
}

// CreateCollectionHandler POST /api/v1/vectors/collections
func CreateCollectionHandler(w http.ResponseWriter, r *http.Request) {
	var req CreateCollectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Name == "" {
		types.WriteError(w, http.StatusBadRequest, "Name is required")
		return
	}
	if req.Color == "" {
		req.Color = "#3b82f6"
	}

	col := &types.Collection{
		Name:        req.Name,
		Description: req.Description,
		Color:       req.Color,
	}

	repo := database.NewVectorRepository()
	if err := repo.CreateCollection(col); err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			types.WriteError(w, http.StatusConflict, "Collection name already exists")
			return
		}
		types.WriteError(w, http.StatusInternalServerError, "Failed to create collection")
		return
	}

	types.WriteSuccess(w, "Collection created", col)
}

// CollectionsHandler handles GET/POST /api/v1/vectors/collections
func CollectionsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		ListCollectionsHandler(w, r)
	case http.MethodPost:
		CreateCollectionHandler(w, r)
	default:
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

// DeleteCollectionHandler DELETE /api/v1/vectors/collections/{id}
func DeleteCollectionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	id := extractVectorID(r.URL.Path, 4)
	if id == uuid.Nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid collection ID")
		return
	}

	repo := database.NewVectorRepository()
	if err := repo.DeleteCollection(id); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to delete collection")
		return
	}

	types.WriteSuccess(w, "Collection deleted", nil)
}

// ── Collection Documents ─────────────────────────────────────────────────────

type AddDocToCollectionRequest struct {
	DocumentID string `json:"document_id"`
}

// AddDocToCollectionHandler POST /api/v1/vectors/collections/{id}/documents
func AddDocToCollectionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	collectionID := extractVectorID(r.URL.Path, 4)
	if collectionID == uuid.Nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid collection ID")
		return
	}

	var req AddDocToCollectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	docID, err := uuid.Parse(req.DocumentID)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid document_id")
		return
	}

	repo := database.NewVectorRepository()
	if err := repo.AddDocumentToCollection(collectionID, docID); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to add document to collection")
		return
	}

	types.WriteSuccess(w, "Document added to collection", nil)
}

// RemoveDocFromCollectionHandler DELETE /api/v1/vectors/collections/{id}/documents/{doc_id}
func RemoveDocFromCollectionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Path: /api/v1/vectors/collections/{id}/documents/{doc_id}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 7 {
		types.WriteError(w, http.StatusBadRequest, "Invalid path")
		return
	}

	collectionID, err := uuid.Parse(parts[4])
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid collection ID")
		return
	}

	docID, err := uuid.Parse(parts[6])
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid document ID")
		return
	}

	repo := database.NewVectorRepository()
	if err := repo.RemoveDocumentFromCollection(collectionID, docID); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to remove document from collection")
		return
	}

	types.WriteSuccess(w, "Document removed from collection", nil)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func extractVectorID(path string, position int) uuid.UUID {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) <= position {
		return uuid.Nil
	}
	id, err := uuid.Parse(parts[position])
	if err != nil {
		return uuid.Nil
	}
	return id
}
