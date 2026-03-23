package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/helpcenter"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

func GetHelpCenterStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	hc := helpcenter.GetGlobalHelpCenter()
	if hc == nil { types.WriteError(w, http.StatusServiceUnavailable, "Help center not initialized"); return }
	types.WriteSuccess(w, "Help center stats retrieved", hc.GetStats())
}

func GetGuidesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	hc := helpcenter.GetGlobalHelpCenter()
	if hc == nil { types.WriteError(w, http.StatusServiceUnavailable, "Help center not initialized"); return }
	guides := hc.GetGuides()
	types.WriteSuccess(w, "Guides retrieved", map[string]interface{}{"guides": guides, "count": len(guides)})
}

func GetFAQsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	hc := helpcenter.GetGlobalHelpCenter()
	if hc == nil { types.WriteError(w, http.StatusServiceUnavailable, "Help center not initialized"); return }
	faqs := hc.GetFAQs()
	types.WriteSuccess(w, "FAQs retrieved", map[string]interface{}{"faqs": faqs, "count": len(faqs)})
}

func GetTutorialsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	hc := helpcenter.GetGlobalHelpCenter()
	if hc == nil { types.WriteError(w, http.StatusServiceUnavailable, "Help center not initialized"); return }
	tutorials := hc.GetTutorials()
	types.WriteSuccess(w, "Tutorials retrieved", map[string]interface{}{"tutorials": tutorials, "count": len(tutorials)})
}

func SearchHelpCenterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	hc := helpcenter.GetGlobalHelpCenter()
	if hc == nil { types.WriteError(w, http.StatusServiceUnavailable, "Help center not initialized"); return }
	q := r.URL.Query().Get("q")
	if q == "" { types.WriteError(w, http.StatusBadRequest, "q query parameter required"); return }
	types.WriteSuccess(w, "Search results", hc.Search(q))
}

func VoteFAQHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	hc := helpcenter.GetGlobalHelpCenter()
	if hc == nil { types.WriteError(w, http.StatusServiceUnavailable, "Help center not initialized"); return }
	var req struct { ID string `json:"id"` }
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" { types.WriteError(w, http.StatusBadRequest, "id required"); return }
	if err := hc.VoteFAQ(req.ID); err != nil { types.WriteError(w, http.StatusNotFound, err.Error()); return }
	types.WriteSuccess(w, "Vote recorded", map[string]string{"id": req.ID})
}
