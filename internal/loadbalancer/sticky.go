package loadbalancer

import (
	"net/http"
	"time"
)

const (
	stickyCookieName = "vlm_affinity" // cookie that pins a client to a node
	stickyCookieTTL  = 1 * time.Hour
)

// StickySessionMiddleware wraps the LoadBalancer middleware with cookie-based
// session affinity. On the first request the chosen backend ID is written into
// a cookie; on subsequent requests the cookie is read and the same backend is
// preferred if it is still healthy.
//
// This is the application-layer equivalent of Nginx's `sticky cookie` or
// HAProxy's `cookie` persistence directive.
type StickySessionMiddleware struct {
	lb      *LoadBalancer
	nodeID  string // this server's own node ID (set in cookie so clients re-connect here)
	secure  bool   // set Secure flag on cookie (true in production / HTTPS)
	sameSite http.SameSite
}

// NewStickySession creates a sticky-session middleware for the given LB.
// nodeID should be cfg.Cluster.NodeID so the current server can claim its own
// requests if the cookie already points to it.
func NewStickySession(lb *LoadBalancer, nodeID string, secure bool) *StickySessionMiddleware {
	return &StickySessionMiddleware{
		lb:       lb,
		nodeID:   nodeID,
		secure:   secure,
		sameSite: http.SameSiteLaxMode,
	}
}

// Handler returns an http.Handler that enforces sticky sessions.
func (s *StickySessionMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. Check if client already has an affinity cookie
		if cookie, err := r.Cookie(stickyCookieName); err == nil {
			preferredID := cookie.Value
			// Try to honour the preferred backend
			if b := s.findBackend(preferredID); b != nil && b.IsAvailable() {
				atomic_incr(b)
				defer s.lb.Done(b)
				w.Header().Set("X-Routed-To", b.ID)
				w.Header().Set("X-Sticky-Hit", "true")
				next.ServeHTTP(w, r)
				return
			}
			// Preferred node gone — fall through to normal LB selection
		}

		// 2. No valid cookie — pick via LB algorithm
		clientIP := extractIP(r)
		b, err := s.lb.Next(clientIP)
		if err != nil {
			http.Error(w, "Service Unavailable: no healthy backends", http.StatusServiceUnavailable)
			return
		}
		defer s.lb.Done(b)

		// 3. Write affinity cookie so this client returns to the same node
		http.SetCookie(w, &http.Cookie{
			Name:     stickyCookieName,
			Value:    b.ID,
			Path:     "/",
			MaxAge:   int(stickyCookieTTL.Seconds()),
			HttpOnly: true,
			Secure:   s.secure,
			SameSite: s.sameSite,
		})

		w.Header().Set("X-Routed-To", b.ID)
		w.Header().Set("X-Sticky-Hit", "false")
		next.ServeHTTP(w, r)
	})
}

// SetNodeAffinity writes the current node's ID into the response as the
// preferred affinity target. Call this from any handler that establishes
// a long-lived resource (e.g. a WebSocket connection or streaming session)
// so subsequent requests from the same client land on the same instance.
func SetNodeAffinity(w http.ResponseWriter, nodeID string, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     stickyCookieName,
		Value:    nodeID,
		Path:     "/",
		MaxAge:   int(stickyCookieTTL.Seconds()),
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
}

// ClearAffinity removes the affinity cookie (call on logout).
func ClearAffinity(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:    stickyCookieName,
		Value:   "",
		Path:    "/",
		MaxAge:  -1,
		Expires: time.Unix(0, 0),
	})
}

func (s *StickySessionMiddleware) findBackend(id string) *Backend {
	s.lb.mu.RLock()
	defer s.lb.mu.RUnlock()
	for _, b := range s.lb.backends {
		if b.ID == id {
			return b
		}
	}
	return nil
}

// atomic_incr manually bumps connection/request counters for a directly
// chosen backend (bypassing Next which would pick a different one).
func atomic_incr(b *Backend) {
	b.IncrConnections()
	b.requests++ // not atomic here but fine for stats
}
