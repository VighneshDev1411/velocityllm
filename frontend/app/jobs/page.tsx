'use client';

import { useState, useEffect } from 'react';
import { workerAPI, JobSubmission, JobStatus } from '@/lib/api';
import { Send, Loader2, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react';

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    prompt: '',
    model: 'gpt-3.5-turbo',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'critical',
    maxTokens: 512,
    temperature: 0.7,
  });

  const [submittedJobIds, setSubmittedJobIds] = useState<string[]>([]);

  // Fetch job statuses
  const fetchJobStatuses = async () => {
    try {
      const statuses = await Promise.all(
        submittedJobIds.map(id =>
          workerAPI.getJobStatus(id)
            .then((res: any) => res.data.data)
            .catch(() => null)
        )
      );

      setJobs(statuses.filter(Boolean));
    } catch (err) {
      console.error('Error fetching job statuses:', err);
    }
  };

  useEffect(() => {
    if (submittedJobIds.length > 0) {
      fetchJobStatuses();
      const interval = setInterval(fetchJobStatuses, 2000);
      return () => clearInterval(interval);
    }
  }, [submittedJobIds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const jobData: JobSubmission = {
        type: 'inference',
        priority: formData.priority,
        payload: {
          prompt: formData.prompt,
          model: formData.model,
          max_tokens: formData.maxTokens,
          temperature: formData.temperature,
        },
        timeout_seconds: 60,
      };

      const response = await workerAPI.submitJob(jobData);
      const jobId = response.data.data.job_id;
      
      setSubmittedJobIds(prev => [jobId, ...prev]);
      
      // Reset form
      setFormData(prev => ({ ...prev, prompt: '' }));
      
      alert(`Job submitted successfully! ID: ${jobId}`);
    } catch (err: any) {
      alert('Failed to submit job: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) return;
    
    try {
      await workerAPI.cancelJob(jobId);
      fetchJobStatuses();
    } catch (err: any) {
      alert('Failed to cancel job: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Job Management</h1>
          <p className="text-gray-500 mt-2">Submit and monitor inference jobs</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Submit Job Form */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Submit New Job</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prompt
                </label>
                <textarea
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  rows={4}
                  placeholder="Enter your prompt here..."
                  required
                />
              </div>

              {/* Model Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Model
                </label>
                <select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="gpt2">GPT-2 (Testing)</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="llama-2-7b">Llama-2-7B</option>
                  <option value="mistral-7b">Mistral-7B</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Parameters */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    value={formData.maxTokens}
                    onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    min="1"
                    max="4096"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Temperature
                  </label>
                  <input
                    type="number"
                    value={formData.temperature}
                    onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    min="0"
                    max="2"
                    step="0.1"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !formData.prompt}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Submit Job
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Job Queue */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Job Queue</h2>
              <span className="text-sm text-gray-500">{jobs.length} jobs</span>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {jobs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No jobs submitted yet</p>
                  <p className="text-sm mt-2">Submit a job to get started</p>
                </div>
              ) : (
                jobs.map((job) => (
                  <JobCard key={job.job_id} job={job} onCancel={handleCancel} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Job Card Component
function JobCard({ job, onCancel }: { job: JobStatus; onCancel: (id: string) => void }) {
  const getStatusIcon = () => {
    switch (job.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
      case 'timeout':
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusColor = () => {
    switch (job.status) {
      case 'completed':
        return 'status-healthy';
      case 'failed':
      case 'timeout':
      case 'cancelled':
        return 'status-critical';
      case 'running':
        return 'status-busy';
      default:
        return 'status-degraded';
    }
  };

  const getPriorityColor = () => {
    switch (job.priority) {
      case 'critical':
        return 'priority-critical';
      case 'high':
        return 'priority-high';
      case 'normal':
        return 'priority-normal';
      default:
        return 'priority-low';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <p className="font-mono text-sm text-gray-900">{job.job_id}</p>
            <p className="text-xs text-gray-500">{job.type}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`status-badge ${getStatusColor()}`}>
            {job.status}
          </span>
          <span className={`status-badge ${getPriorityColor()}`}>
            {job.priority}
          </span>
        </div>
      </div>

      {/* Timing Info */}
      {job.duration_ms && (
        <div className="text-xs text-gray-600 mb-2">
          Duration: {job.duration_ms}ms
          {job.wait_time_ms && ` | Wait: ${job.wait_time_ms}ms`}
        </div>
      )}

      {/* Worker ID */}
      {job.worker_id && (
        <div className="text-xs text-gray-600 mb-2">
          Worker: {job.worker_id}
        </div>
      )}

      {/* Result */}
      {job.result && (
        <div className="mt-3 p-3 bg-green-50 rounded border border-green-200">
          <p className="text-xs font-semibold text-green-900 mb-1">Result:</p>
          <p className="text-sm text-green-800">
            {JSON.stringify(job.result).substring(0, 100)}...
          </p>
        </div>
      )}

      {/* Error */}
      {job.error && (
        <div className="mt-3 p-3 bg-red-50 rounded border border-red-200">
          <p className="text-xs font-semibold text-red-900 mb-1">Error:</p>
          <p className="text-sm text-red-800">{job.error}</p>
        </div>
      )}

      {/* Actions */}
      {(job.status === 'pending' || job.status === 'queued' || job.status === 'running') && (
        <button
          onClick={() => onCancel(job.job_id)}
          className="mt-3 flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition"
        >
          <Trash2 className="w-4 h-4" />
          Cancel Job
        </button>
      )}
    </div>
  );
}