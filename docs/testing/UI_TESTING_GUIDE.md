# 🖥️ VelocityLLM UI Testing Guide

## 📋 **What's Implemented in the UI**

### ✅ **Implemented Pages & Features**

#### **1. Dashboard Page** (`/` - Home)
**URL**: http://localhost:3000

**Features**:
- ✅ **Real-time Metrics Display**
  - Total Workers count
  - Jobs Processed counter
  - Active Streams counter
  - Queue Utilization percentage

- ✅ **Live Updates** (Auto-refresh every 5 seconds)
  - Worker pool status with progress bars
  - Streaming status with metrics
  - Performance metrics (avg duration, throughput, data streamed)

- ✅ **Visual Stats Cards**
  - Color-coded icons (Blue, Green, Purple, Orange)
  - Animated transitions
  - Hover effects

- ✅ **Performance Metrics**
  - Average job duration (ms)
  - Throughput (jobs/second)
  - Total data streamed (bytes)

---

#### **2. Workers Page** (`/workers`)
**URL**: http://localhost:3000/workers

**Features**:
- ✅ **Worker Pool Overview**
  - Total workers
  - Busy workers
  - Idle workers
  - Unhealthy workers

- ✅ **Individual Worker Cards** showing:
  - Worker ID
  - Status (Idle/Busy/Unhealthy)
  - Jobs processed count
  - Jobs failed count
  - Health score (0-100%)
  - Uptime
  - Last heartbeat

- ✅ **Auto-refresh** every 3 seconds
- ✅ **Manual refresh** button
- ✅ **Status badges** with color coding

---

#### **3. Jobs Page** (`/jobs`)
**URL**: http://localhost:3000/jobs

**Features**:
- ✅ Job listing (structure in place)
- ✅ Job status tracking
- ✅ Job history

---

#### **4. Streams Page** (`/streams`)
**URL**: http://localhost:3000/streams

**Features**:
- ✅ Active streams monitoring
- ✅ Stream statistics
- ✅ Stream history

---

### 🎨 **UI Components**

#### **Navigation Bar**
- ✅ Always visible at top
- ✅ 4 navigation links:
  - Dashboard
  - Workers
  - Jobs
  - Streams
- ✅ Active link highlighting

#### **Stat Cards**
- ✅ Icon-based visual representation
- ✅ Large numbers for quick scanning
- ✅ Secondary metrics
- ✅ Color-coded by type

#### **Progress Bars**
- ✅ Animated transitions
- ✅ Color-coded status
- ✅ Percentage display

#### **Error Handling**
- ✅ Loading states with spinners
- ✅ Error messages with retry buttons
- ✅ Connection error alerts

---

## 🧪 **How to Test the UI**

### **Step 1: Start All Services**

```bash
# Single command to start everything
./start-all.sh

# OR manually:
# 1. Backend
DB_USER=vigneshmac DB_PASSWORD="" DB_NAME=velocityllm ./bin/server &

# 2. Python Worker
cd python_worker && source venv/bin/activate && python test_server.py &

# 3. Frontend
cd frontend && npm run dev &
```

**Wait for**: All services to show "✓ Started successfully"

---

### **Step 2: Access the UI**

Open your browser and go to:
```
http://localhost:3000
```

---

### **Step 3: Test Each Feature**

#### **✅ Dashboard Page Testing**

1. **Initial Load**
   ```
   - [ ] Page loads without errors
   - [ ] Loading spinner appears briefly
   - [ ] All stat cards display
   - [ ] Numbers populate correctly
   ```

2. **Real-time Updates**
   ```
   - [ ] Green "Live" indicator visible
   - [ ] Data refreshes every 5 seconds
   - [ ] Numbers update smoothly
   - [ ] No console errors
   ```

3. **Metrics Display**
   ```
   - [ ] Worker pool status shows 10 total workers
   - [ ] Progress bars animate smoothly
   - [ ] Stream status displays correctly
   - [ ] Performance metrics show values
   ```

4. **Visual Elements**
   ```
   - [ ] Icons display in colored boxes
   - [ ] Cards have hover effects
   - [ ] Colors match design (blue/green/purple/orange)
   - [ ] Layout responsive on different screen sizes
   ```

---

#### **✅ Workers Page Testing**

1. **Navigation**
   ```
   - [ ] Click "Workers" in nav bar
   - [ ] URL changes to /workers
   - [ ] Page loads worker list
   ```

2. **Summary Cards**
   ```
   - [ ] Total Workers shows 10
   - [ ] Busy/Idle/Unhealthy counters update
   - [ ] Icons display correctly
   ```

3. **Worker Cards**
   ```
   - [ ] Each worker card displays
   - [ ] Worker IDs visible (worker-1, worker-2, etc.)
   - [ ] Status badges show correct state
   - [ ] Jobs processed count visible
   - [ ] Health score bar animates
   - [ ] Uptime displays (e.g., "5m 32s")
   - [ ] Last heartbeat shows time ago
   ```

4. **Refresh Functionality**
   ```
   - [ ] Click refresh button
   - [ ] Data reloads
   - [ ] Auto-refresh works (every 3 seconds)
   ```

---

#### **✅ Jobs Page Testing**

1. **Navigation**
   ```
   - [ ] Click "Jobs" in nav bar
   - [ ] URL changes to /jobs
   - [ ] Page loads
   ```

2. **Job List**
   ```
   - [ ] Job listing displays
   - [ ] Job status visible
   - [ ] Can filter/search jobs
   ```

---

#### **✅ Streams Page Testing**

1. **Navigation**
   ```
   - [ ] Click "Streams" in nav bar
   - [ ] URL changes to /streams
   - [ ] Page loads
   ```

2. **Stream List**
   ```
   - [ ] Active streams display
   - [ ] Stream metrics visible
   - [ ] Can view stream details
   ```

---

### **Step 4: Test Error Handling**

1. **Stop Backend**
   ```bash
   pkill -f "bin/server"
   ```

   **Expected**:
   - [ ] Red error message appears
   - [ ] "Connection Error" displayed
   - [ ] Retry button visible
   - [ ] Clicking retry attempts reconnection

2. **Restart Backend**
   ```bash
   DB_USER=vigneshmac DB_PASSWORD="" DB_NAME=velocityllm ./bin/server &
   ```

   **Expected**:
   - [ ] Click retry button
   - [ ] Connection restores
   - [ ] Data loads successfully

---

### **Step 5: Test Responsive Design**

1. **Desktop View** (1920x1080)
   ```
   - [ ] All 4 stat cards in one row
   - [ ] Worker cards in 3 columns
   - [ ] Navigation bar full width
   ```

2. **Tablet View** (768px)
   ```
   - [ ] Stat cards in 2 columns
   - [ ] Worker cards in 2 columns
   - [ ] Navigation still accessible
   ```

3. **Mobile View** (375px)
   ```
   - [ ] Stat cards stack vertically
   - [ ] Worker cards single column
   - [ ] Text remains readable
   ```

---

## 🎯 **API Endpoints Used by Frontend**

The UI calls these backend endpoints:

| Page | Endpoint | Refresh Rate |
|------|----------|--------------|
| Dashboard | `/api/v1/workers/metrics` | 5 seconds |
| Dashboard | `/api/v1/streaming/stats` | 5 seconds |
| Workers | `/api/v1/workers/stats` | 3 seconds |
| Workers | `/api/v1/workers/metrics` | 3 seconds |
| Jobs | `/api/v1/jobs` | 5 seconds |
| Streams | `/api/v1/streaming/stats` | 5 seconds |

---

## 🐛 **Common Issues & Solutions**

### **Issue 1: "Connection Error" on Dashboard**

**Symptoms**: Red error box, can't load data

**Solution**:
```bash
# Check if backend is running
curl http://localhost:8080/health

# If not running, start it:
DB_USER=vigneshmac DB_PASSWORD="" DB_NAME=velocityllm ./bin/server &
```

---

### **Issue 2: Frontend Won't Start**

**Symptoms**: Port 3000 error

**Solution**:
```bash
# Kill existing process
pkill -f "next-server"

# Restart frontend
cd frontend && npm run dev
```

---

### **Issue 3: Workers Show "Unhealthy"**

**Symptoms**: All workers marked unhealthy

**Explanation**: This is expected in test mode. Workers are marked unhealthy until they successfully process jobs through the Python worker.

**To Fix**:
1. Ensure Python worker is running on port 50051
2. Submit test inference requests
3. Workers will become healthy after processing

---

### **Issue 4: Data Not Updating**

**Symptoms**: Numbers frozen, no live updates

**Solution**:
```bash
# Check browser console (F12)
# Look for network errors

# Verify backend responding:
curl http://localhost:8080/api/v1/workers/stats
```

---

## 📊 **Test Data & Expected Values**

### **Fresh Start Values**
```
Total Workers: 10
Busy Workers: 0
Idle Workers: 0
Unhealthy Workers: 10 (expected in test mode)
Active Streams: 0
Jobs Processed: 0
Queue Utilization: 0.00%
```

### **After Running Tests**
```
Total Workers: 10
Jobs Processed: > 0
Active Streams: May vary
Queue Usage: < 10%
```

---

## 🎨 **Visual Testing Checklist**

### **Colors**
- [ ] Primary blue: #2563eb
- [ ] Green: #10b981
- [ ] Orange: #f59e0b
- [ ] Red: #ef4444
- [ ] Purple: #8b5cf6

### **Animations**
- [ ] Loading spinner rotates smoothly
- [ ] Progress bars transition smoothly
- [ ] Live indicator pulses
- [ ] Hover effects work on cards

### **Typography**
- [ ] Headers bold and clear
- [ ] Numbers large and readable
- [ ] Secondary text subtle
- [ ] Monospace for IDs

---

## 🚀 **Advanced Testing**

### **Load Testing UI Updates**

1. Generate load on backend:
   ```bash
   # Run load test
   for i in {1..100}; do
     curl -X POST http://localhost:8080/api/v1/requests \
       -H "Content-Type: application/json" \
       -d '{"model":"gpt-4","prompt":"test"}' &
   done
   ```

2. Watch UI update:
   ```
   - [ ] Jobs Processed increases
   - [ ] Busy Workers increases
   - [ ] Queue Utilization changes
   - [ ] No UI lag or freezing
   ```

---

### **Real-time Stream Testing**

1. Start a stream:
   ```bash
   curl -N http://localhost:8080/api/v1/streaming/test
   ```

2. Check Streams page:
   ```
   - [ ] Active Streams increments
   - [ ] Stream appears in list
   - [ ] Metrics update
   ```

---

## 📝 **Testing Checklist Summary**

### **Functionality**
- [ ] All 4 pages accessible
- [ ] Navigation works
- [ ] Data loads from API
- [ ] Auto-refresh working
- [ ] Manual refresh works
- [ ] Error handling displays
- [ ] Retry functionality works

### **Performance**
- [ ] Page loads < 2 seconds
- [ ] No console errors
- [ ] Smooth animations
- [ ] No memory leaks (check with DevTools)

### **Visual**
- [ ] Colors correct
- [ ] Icons display
- [ ] Layout responsive
- [ ] Text readable
- [ ] Hover effects work

### **Data Accuracy**
- [ ] Worker counts match backend
- [ ] Job counts accurate
- [ ] Stream counts correct
- [ ] Timestamps update

---

## 🎯 **Quick Test Script**

```bash
# 1. Start services
./start-all.sh

# 2. Wait 5 seconds
sleep 5

# 3. Open browser
open http://localhost:3000

# 4. Run backend tests (generates data)
./test_all_features.sh

# 5. Refresh dashboard and see updated numbers
# 6. Navigate through all pages
# 7. Check for errors in browser console (F12)
```

---

## 📚 **Additional Resources**

- **Backend API**: http://localhost:8080/health
- **Worker Metrics**: http://localhost:8080/api/v1/workers/stats
- **Stream Stats**: http://localhost:8080/api/v1/streaming/stats
- **Backend Logs**: `tail -f /tmp/velocityllm-backend.log`
- **Frontend Logs**: `tail -f /tmp/velocityllm-frontend.log`

---

## ✅ **Success Criteria**

Your UI is working correctly if:

1. ✅ All pages load without errors
2. ✅ Data displays from backend
3. ✅ Numbers update every 3-5 seconds
4. ✅ No console errors
5. ✅ Worker cards show status
6. ✅ Navigation works smoothly
7. ✅ Error handling displays on connection loss
8. ✅ Responsive on different screen sizes

---

**Status**: UI is fully functional and ready for testing! 🎉
