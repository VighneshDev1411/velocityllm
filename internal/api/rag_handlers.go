package api

import (
	"encoding/json"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/VighneshDev1411/velocityllm/internal/database"
	"github.com/VighneshDev1411/velocityllm/internal/llm"
	"github.com/VighneshDev1411/velocityllm/internal/rag"
	"github.com/VighneshDev1411/velocityllm/internal/streaming"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/google/uuid"
)

// ── Upload Document ──────────────────────────────────────────────────────────

type UploadDocumentRequest struct {
	Name    string `json:"name"`
	Content string `json:"content"`
	Type    string `json:"type"` // text, markdown
}

// UploadDocumentHandler POST /api/v1/rag/documents
// Supports two content types:
//   - application/json: { name, content, type } for pasted text
//   - multipart/form-data: file upload (PDF, TXT, MD)
func UploadDocumentHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req UploadDocumentRequest

	contentType := r.Header.Get("Content-Type")

	if strings.HasPrefix(contentType, "multipart/form-data") {
		// File upload — parse up to 20MB
		if err := r.ParseMultipartForm(20 << 20); err != nil {
			types.WriteError(w, http.StatusBadRequest, "Failed to parse multipart form")
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			types.WriteError(w, http.StatusBadRequest, "File is required (field: 'file')")
			return
		}
		defer file.Close()

		fileBytes, err := io.ReadAll(file)
		if err != nil {
			types.WriteError(w, http.StatusInternalServerError, "Failed to read file")
			return
		}

		ext := strings.ToLower(filepath.Ext(header.Filename))
		req.Name = header.Filename

		switch ext {
		case ".pdf":
			text, err := rag.ExtractTextFromPDF(fileBytes)
			if err != nil {
				types.WriteError(w, http.StatusBadRequest, "Failed to extract text from PDF: "+err.Error())
				return
			}
			req.Content = text
			req.Type = "pdf"
		case ".txt", ".text", ".csv":
			req.Content = string(fileBytes)
			req.Type = "text"
		case ".md", ".markdown":
			req.Content = string(fileBytes)
			req.Type = "markdown"
		default:
			types.WriteError(w, http.StatusBadRequest, "Unsupported file type: "+ext+". Supported: .pdf, .txt, .md, .csv")
			return
		}

		// Allow form field override for name
		if formName := r.FormValue("name"); formName != "" {
			req.Name = formName
		}
	} else {
		// JSON body
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			types.WriteError(w, http.StatusBadRequest, "Invalid request body")
			return
		}
	}

	if req.Content == "" {
		types.WriteError(w, http.StatusBadRequest, "Content is required")
		return
	}
	if req.Name == "" {
		req.Name = "Untitled Document"
	}
	if req.Type == "" {
		req.Type = "text"
	}

	repo := database.NewRAGRepository()
	engine := rag.NewEngine()

	// Create document record
	doc := &types.Document{
		Name:    req.Name,
		Content: req.Content,
		Type:    req.Type,
		Size:    int64(len(req.Content)),
		Status:  "processing",
	}
	if err := repo.CreateDocument(doc); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to create document")
		return
	}

	// Chunk the text
	chunkResults := engine.ChunkText(req.Content)

	// Generate embeddings and create chunk records
	chunks := make([]types.Chunk, len(chunkResults))
	for i, cr := range chunkResults {
		embedding := engine.GenerateEmbedding(cr.Content)
		chunks[i] = types.Chunk{
			DocumentID: doc.ID,
			Content:    cr.Content,
			Index:      cr.Index,
			Embedding:  rag.EmbeddingToJSON(embedding),
			TokenCount: len(strings.Fields(cr.Content)), // approx token count
		}
	}

	// Save chunks
	if err := repo.CreateChunks(chunks); err != nil {
		repo.UpdateDocumentStatus(doc.ID, "error", 0, err.Error())
		types.WriteError(w, http.StatusInternalServerError, "Failed to save chunks")
		return
	}

	// Mark document as ready
	repo.UpdateDocumentStatus(doc.ID, "ready", len(chunks), "")

	utils.Info("Document uploaded and chunked",
		"doc_id", doc.ID,
		"name", doc.Name,
		"chunks", len(chunks),
		"size", doc.Size,
	)

	types.WriteSuccess(w, "Document uploaded and indexed", map[string]interface{}{
		"id":          doc.ID,
		"name":        doc.Name,
		"chunk_count": len(chunks),
		"size":        doc.Size,
		"status":      "ready",
	})
}

// ── List Documents ───────────────────────────────────────────────────────────

// ListDocumentsHandler GET /api/v1/rag/documents
func ListDocumentsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit <= 0 {
		limit = 50
	}

	repo := database.NewRAGRepository()
	docs, total, err := repo.ListDocuments(limit, offset)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to list documents")
		return
	}

	types.WriteJSON(w, http.StatusOK, types.SuccessResponse{
		Success: true,
		Message: "Documents listed",
		Data: map[string]interface{}{
			"documents": docs,
			"total":     total,
		},
	})
}

// ── Get Document ─────────────────────────────────────────────────────────────

// GetDocumentHandler GET /api/v1/rag/documents/{id}
func GetDocumentHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	id := extractDocumentID(r.URL.Path)
	if id == uuid.Nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid document ID")
		return
	}

	repo := database.NewRAGRepository()
	doc, err := repo.GetDocumentWithChunks(id)
	if err != nil {
		types.WriteError(w, http.StatusNotFound, "Document not found")
		return
	}

	types.WriteSuccess(w, "Document retrieved", doc)
}

// ── Delete Document ──────────────────────────────────────────────────────────

// DeleteDocumentHandler DELETE /api/v1/rag/documents/{id}
func DeleteDocumentHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	id := extractDocumentID(r.URL.Path)
	if id == uuid.Nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid document ID")
		return
	}

	repo := database.NewRAGRepository()
	if err := repo.DeleteDocument(id); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to delete document")
		return
	}

	types.WriteSuccess(w, "Document deleted", nil)
}

// ── RAG Query (retrieve + augment + generate) ────────────────────────────────

type RAGQueryRequest struct {
	Query       string   `json:"query"`
	Model       string   `json:"model"`
	DocumentIDs []string `json:"document_ids"` // optional: limit to specific docs
	TopK        int      `json:"top_k"`
	MaxTokens   int      `json:"max_tokens"`
	Temperature float64  `json:"temperature"`
}

// RAGQueryHandler POST /api/v1/rag/query
// Retrieves relevant chunks, builds augmented prompt, streams LLM response
func RAGQueryHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req RAGQueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Query == "" {
		types.WriteError(w, http.StatusBadRequest, "Query is required")
		return
	}
	if req.Model == "" {
		req.Model = "claude-sonnet-4-20250514"
	}
	if req.MaxTokens == 0 {
		req.MaxTokens = 1024
	}
	if req.Temperature == 0 {
		req.Temperature = 0.7
	}
	if req.TopK == 0 {
		req.TopK = 5
	}

	repo := database.NewRAGRepository()
	engine := rag.NewEngine()

	// Load chunks
	var chunks []types.Chunk
	var err error

	if len(req.DocumentIDs) > 0 {
		var docUUIDs []uuid.UUID
		for _, idStr := range req.DocumentIDs {
			if uid, parseErr := uuid.Parse(idStr); parseErr == nil {
				docUUIDs = append(docUUIDs, uid)
			}
		}
		chunks, err = repo.GetChunksForDocuments(docUUIDs)
	} else {
		chunks, err = repo.GetAllChunksWithEmbeddings()
	}

	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to load chunks")
		return
	}

	if len(chunks) == 0 {
		types.WriteError(w, http.StatusBadRequest, "No documents indexed. Upload documents first.")
		return
	}

	// Generate query embedding
	queryEmbedding := engine.GenerateEmbedding(req.Query)

	// Build candidates
	// Get document names for display
	docIDSet := make(map[uuid.UUID]bool)
	for _, c := range chunks {
		docIDSet[c.DocumentID] = true
	}
	var uniqueDocIDs []uuid.UUID
	for id := range docIDSet {
		uniqueDocIDs = append(uniqueDocIDs, id)
	}
	docNames, _ := repo.GetDocumentNames(uniqueDocIDs)

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

	// Retrieve top K
	results := engine.FindTopK(queryEmbedding, candidates)

	// Build augmented prompt
	augmentedPrompt := engine.BuildRAGPrompt(req.Query, results)

	utils.Info("RAG query",
		"query", req.Query,
		"chunks_searched", len(candidates),
		"top_results", len(results),
	)

	// Set up SSE streaming
	sseHandler, err := streaming.NewSSEHandler(w)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "SSE not supported")
		return
	}

	// Send retrieval results first
	sseHandler.WriteSSE(streaming.StreamMessage{
		Type: "retrieval",
		Data: map[string]interface{}{
			"results":   results,
			"query":     req.Query,
			"total":     len(candidates),
			"retrieved": len(results),
		},
	})

	// Stream LLM response
	provider := llm.GetProvider()
	var fullResponse string

	if provider.IsAvailable() {
		index := 0
		result, llmErr := provider.StreamComplete(augmentedPrompt, req.Model, req.Temperature, req.MaxTokens, 1.0, func(token string) error {
			if writeErr := sseHandler.WriteToken(token, index); writeErr != nil {
				return writeErr
			}
			index++
			return nil
		})
		if llmErr != nil {
			sseHandler.WriteError("LLM_ERROR", llmErr.Error(), "provider_error")
			sseHandler.WriteDone()
			return
		}
		if result != nil {
			fullResponse = result.Response
		}
	} else {
		// Fallback: simulate
		tokenChan := streaming.SimulateTokenStream(req.Query, req.Model)
		index := 0
		for token := range tokenChan {
			if err := sseHandler.WriteToken(token, index); err != nil {
				return
			}
			fullResponse += token
			index++
		}
	}

	// Send completion metadata
	sseHandler.WriteSSE(streaming.StreamMessage{
		Type: "complete",
		Data: map[string]interface{}{
			"response_length": len(fullResponse),
			"sources":         len(results),
		},
	})

	sseHandler.WriteDone()
}

// ── RAG Stats ────────────────────────────────────────────────────────────────

// RAGStatsHandler GET /api/v1/rag/stats
func RAGStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	repo := database.NewRAGRepository()
	stats, err := repo.GetRAGStats()
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to get stats")
		return
	}

	types.WriteSuccess(w, "RAG statistics", stats)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func extractDocumentID(path string) uuid.UUID {
	// Path: /api/v1/rag/documents/{id}
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) < 5 {
		return uuid.Nil
	}
	id, err := uuid.Parse(parts[4])
	if err != nil {
		return uuid.Nil
	}
	return id
}
