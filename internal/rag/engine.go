package rag

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"sync"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// Engine is the core RAG pipeline: chunk → embed → store → retrieve → augment
type Engine struct {
	mu           sync.RWMutex
	chunkSize    int
	chunkOverlap int
	embeddingDim int
	topK         int
}

// NewEngine creates a RAG engine with sensible defaults
func NewEngine() *Engine {
	return &Engine{
		chunkSize:    500,  // ~500 chars per chunk
		chunkOverlap: 50,   // 50 char overlap between chunks
		embeddingDim: 384,  // matches semantic cache dimension
		topK:         5,    // return top 5 relevant chunks
	}
}

// ── Chunking ─────────────────────────────────────────────────────────────────

// ChunkResult holds a text chunk and its position
type ChunkResult struct {
	Content string
	Index   int
}

// ChunkText splits text into overlapping chunks
func (e *Engine) ChunkText(text string) []ChunkResult {
	text = strings.TrimSpace(text)
	if len(text) == 0 {
		return nil
	}

	// First try to split on paragraph boundaries
	paragraphs := splitParagraphs(text)

	var chunks []ChunkResult
	idx := 0
	var buffer strings.Builder

	for _, para := range paragraphs {
		para = strings.TrimSpace(para)
		if para == "" {
			continue
		}

		// If adding this paragraph exceeds chunk size, flush the buffer
		if buffer.Len() > 0 && buffer.Len()+len(para)+1 > e.chunkSize {
			chunks = append(chunks, ChunkResult{
				Content: strings.TrimSpace(buffer.String()),
				Index:   idx,
			})
			idx++

			// Overlap: keep the last portion of the buffer
			prev := buffer.String()
			buffer.Reset()
			if len(prev) > e.chunkOverlap {
				buffer.WriteString(prev[len(prev)-e.chunkOverlap:])
				buffer.WriteString(" ")
			}
		}

		if buffer.Len() > 0 {
			buffer.WriteString("\n\n")
		}
		buffer.WriteString(para)
	}

	// Flush remaining
	if buffer.Len() > 0 {
		chunks = append(chunks, ChunkResult{
			Content: strings.TrimSpace(buffer.String()),
			Index:   idx,
		})
	}

	// If we got very few chunks (document is small), just return them
	// If a single chunk is too large, split it by sentences
	var finalChunks []ChunkResult
	finalIdx := 0
	for _, c := range chunks {
		if len(c.Content) > e.chunkSize*2 {
			// Split large chunk by sentences
			sentences := splitSentences(c.Content)
			var buf strings.Builder
			for _, s := range sentences {
				if buf.Len() > 0 && buf.Len()+len(s)+1 > e.chunkSize {
					finalChunks = append(finalChunks, ChunkResult{
						Content: strings.TrimSpace(buf.String()),
						Index:   finalIdx,
					})
					finalIdx++
					buf.Reset()
				}
				if buf.Len() > 0 {
					buf.WriteString(" ")
				}
				buf.WriteString(s)
			}
			if buf.Len() > 0 {
				finalChunks = append(finalChunks, ChunkResult{
					Content: strings.TrimSpace(buf.String()),
					Index:   finalIdx,
				})
				finalIdx++
			}
		} else {
			c.Index = finalIdx
			finalChunks = append(finalChunks, c)
			finalIdx++
		}
	}

	utils.Info("Text chunked", "total_chunks", len(finalChunks), "text_length", len(text))
	return finalChunks
}

// ── Embeddings ───────────────────────────────────────────────────────────────

// GenerateEmbedding creates a simple embedding vector for text.
// Uses character frequency + n-gram features (placeholder for a real model).
func (e *Engine) GenerateEmbedding(text string) []float64 {
	text = strings.ToLower(strings.TrimSpace(text))
	embedding := make([]float64, e.embeddingDim)

	if len(text) == 0 {
		return embedding
	}

	// Character frequency (first 128 dimensions — ASCII range)
	charFreq := make(map[rune]int)
	for _, ch := range text {
		charFreq[ch]++
	}
	for ch := rune(0); ch < 128 && int(ch) < e.embeddingDim; ch++ {
		if count, ok := charFreq[ch]; ok {
			embedding[int(ch)] = float64(count) / float64(len(text))
		}
	}

	// Bigram features (dimensions 128-256)
	bigramMap := make(map[string]int)
	runes := []rune(text)
	for i := 0; i < len(runes)-1; i++ {
		bigram := string(runes[i : i+2])
		bigramMap[bigram]++
	}
	bigramIdx := 128
	for _, count := range bigramMap {
		if bigramIdx >= 256 || bigramIdx >= e.embeddingDim {
			break
		}
		embedding[bigramIdx] = float64(count) / float64(len(runes))
		bigramIdx++
	}

	// Word-level features (dimensions 256-384)
	words := strings.Fields(text)
	if len(words) > 0 && 256 < e.embeddingDim {
		embedding[256] = float64(len(words)) / 100.0 // word count
	}
	if 257 < e.embeddingDim {
		embedding[257] = math.Log(float64(len(text) + 1)) // log length
	}
	if 258 < e.embeddingDim {
		avgWordLen := float64(len(text)) / float64(len(words)+1)
		embedding[258] = avgWordLen / 10.0
	}

	// Unique word ratio
	uniqueWords := make(map[string]bool)
	for _, w := range words {
		uniqueWords[w] = true
	}
	if 259 < e.embeddingDim {
		embedding[259] = float64(len(uniqueWords)) / float64(len(words)+1)
	}

	return normalizeVector(embedding)
}

// EmbeddingToJSON serializes an embedding to JSON string
func EmbeddingToJSON(embedding []float64) string {
	data, _ := json.Marshal(embedding)
	return string(data)
}

// EmbeddingFromJSON deserializes an embedding from JSON string
func EmbeddingFromJSON(s string) ([]float64, error) {
	var embedding []float64
	if err := json.Unmarshal([]byte(s), &embedding); err != nil {
		return nil, fmt.Errorf("invalid embedding JSON: %w", err)
	}
	return embedding, nil
}

// ── Retrieval ────────────────────────────────────────────────────────────────

// RetrievalResult pairs a chunk with its similarity score
type RetrievalResult struct {
	ChunkContent string  `json:"chunk_content"`
	ChunkIndex   int     `json:"chunk_index"`
	DocumentID   string  `json:"document_id"`
	DocumentName string  `json:"document_name"`
	Similarity   float64 `json:"similarity"`
}

// RankedChunk is used internally during retrieval
type RankedChunk struct {
	Content    string
	Index      int
	DocID      string
	DocName    string
	Embedding  []float64
	Similarity float64
}

// FindTopK returns the top K most similar chunks to the query embedding
func (e *Engine) FindTopK(queryEmbedding []float64, candidates []RankedChunk) []RetrievalResult {
	// Score all candidates
	for i := range candidates {
		candidates[i].Similarity = CosineSimilarity(queryEmbedding, candidates[i].Embedding)
	}

	// Sort by similarity descending (simple selection sort for small K)
	k := e.topK
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

	results := make([]RetrievalResult, k)
	for i := 0; i < k; i++ {
		results[i] = RetrievalResult{
			ChunkContent: candidates[i].Content,
			ChunkIndex:   candidates[i].Index,
			DocumentID:   candidates[i].DocID,
			DocumentName: candidates[i].DocName,
			Similarity:   math.Round(candidates[i].Similarity*10000) / 10000,
		}
	}

	return results
}

// BuildRAGPrompt creates an augmented prompt with retrieved context
func (e *Engine) BuildRAGPrompt(query string, results []RetrievalResult) string {
	if len(results) == 0 {
		return query
	}

	var b strings.Builder
	b.WriteString("Use the following context to answer the question. If the context doesn't contain relevant information, say so.\n\n")
	b.WriteString("--- CONTEXT ---\n")

	for i, r := range results {
		b.WriteString(fmt.Sprintf("[Source: %s, chunk %d (relevance: %.2f)]\n", r.DocumentName, r.ChunkIndex, r.Similarity))
		b.WriteString(r.ChunkContent)
		if i < len(results)-1 {
			b.WriteString("\n\n")
		}
	}

	b.WriteString("\n--- END CONTEXT ---\n\n")
	b.WriteString("Question: ")
	b.WriteString(query)

	return b.String()
}

// ── Math utilities ───────────────────────────────────────────────────────────

// CosineSimilarity calculates cosine similarity between two vectors
func CosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0.0
	}

	var dot, normA, normB float64
	for i := range a {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	if normA == 0 || normB == 0 {
		return 0.0
	}

	return dot / (math.Sqrt(normA) * math.Sqrt(normB))
}

func normalizeVector(vec []float64) []float64 {
	var norm float64
	for _, v := range vec {
		norm += v * v
	}
	norm = math.Sqrt(norm)
	if norm == 0 {
		return vec
	}
	out := make([]float64, len(vec))
	for i, v := range vec {
		out[i] = v / norm
	}
	return out
}

// ── Text splitting helpers ───────────────────────────────────────────────────

func splitParagraphs(text string) []string {
	return strings.Split(text, "\n\n")
}

func splitSentences(text string) []string {
	var sentences []string
	var current strings.Builder

	for _, ch := range text {
		current.WriteRune(ch)
		if ch == '.' || ch == '!' || ch == '?' {
			s := strings.TrimSpace(current.String())
			if s != "" {
				sentences = append(sentences, s)
			}
			current.Reset()
		}
	}

	if current.Len() > 0 {
		s := strings.TrimSpace(current.String())
		if s != "" {
			sentences = append(sentences, s)
		}
	}

	return sentences
}
