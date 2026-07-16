'use client';

import { useState, useEffect } from 'react';
import { workerAPI, JobSubmission, JobStatus } from '@/lib/api';
import { Send, Loader2, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import { PageHeader } from '@/components/PageHeader';

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
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <PageHeader
        title="Job Management"
        subtitle="Submit and monitor inference jobs"
      />

      <Grid container spacing={3}>
        {/* Submit Job Form */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
            <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600, color: 'text.primary', mb: 3 }}>
              Submit New Job
            </Typography>

            <form onSubmit={handleSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {/* Prompt */}
                <TextField
                  label="Prompt"
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  multiline
                  rows={4}
                  placeholder="Enter your prompt here..."
                  required
                  fullWidth
                  size="small"
                />

                {/* Model Selection */}
                <TextField
                  label="Model"
                  select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="gpt2">GPT-2 (Testing)</MenuItem>
                  <MenuItem value="gpt-3.5-turbo">GPT-3.5 Turbo</MenuItem>
                  <MenuItem value="gpt-4">GPT-4</MenuItem>
                  <MenuItem value="llama-2-7b">Llama-2-7B</MenuItem>
                  <MenuItem value="mistral-7b">Mistral-7B</MenuItem>
                </TextField>

                {/* Priority */}
                <TextField
                  label="Priority"
                  select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </TextField>

                {/* Parameters */}
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      label="Max Tokens"
                      type="number"
                      value={formData.maxTokens}
                      onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                      fullWidth
                      size="small"
                      slotProps={{ htmlInput: { min: 1, max: 4096 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      label="Temperature"
                      type="number"
                      value={formData.temperature}
                      onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                      fullWidth
                      size="small"
                      slotProps={{ htmlInput: { min: 0, max: 2, step: 0.1 } }}
                    />
                  </Grid>
                </Grid>

                {/* Submit Button */}
                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitting || !formData.prompt}
                  fullWidth
                  startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Send size={18} />}
                  sx={{ py: 1.25 }}
                >
                  {submitting ? 'Submitting...' : 'Submit Job'}
                </Button>
              </Box>
            </form>
          </Paper>
        </Grid>

        {/* Job Queue */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600, color: 'text.primary' }}>
                Job Queue
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                {jobs.length} jobs
              </Typography>
            </Box>

            <Box sx={{ maxHeight: 600, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {jobs.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                  <Typography>No jobs submitted yet</Typography>
                  <Typography sx={{ fontSize: '0.875rem', mt: 1 }}>Submit a job to get started</Typography>
                </Box>
              ) : (
                jobs.map((job) => (
                  <JobCard key={job.job_id} job={job} onCancel={handleCancel} />
                ))
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

// Job Card Component
function JobCard({ job, onCancel }: { job: JobStatus; onCancel: (id: string) => void }) {
  const getStatusIcon = () => {
    switch (job.status) {
      case 'completed':
        return <CheckCircle size={18} style={{ color: '#16a34a' }} />;
      case 'failed':
      case 'timeout':
      case 'cancelled':
        return <XCircle size={18} style={{ color: '#dc2626' }} />;
      case 'running':
        return <CircularProgress size={18} sx={{ color: '#4b8eff' }} />;
      default:
        return <Clock size={18} style={{ color: '#ca8a04' }} />;
    }
  };

  const getStatusChipSx = () => {
    switch (job.status) {
      case 'completed':
        return { backgroundColor: 'rgba(16,185,129,0.1)', color: '#059669' };
      case 'failed':
      case 'timeout':
      case 'cancelled':
        return { backgroundColor: 'rgba(239,68,68,0.1)', color: '#dc2626' };
      case 'running':
        return { backgroundColor: 'rgba(59,130,246,0.1)', color: '#4b8eff' };
      default:
        return { backgroundColor: '#fefce8', color: '#ca8a04' };
    }
  };

  const getPriorityChipSx = () => {
    switch (job.priority) {
      case 'critical':
        return { backgroundColor: 'rgba(239,68,68,0.1)', color: '#dc2626' };
      case 'high':
        return { backgroundColor: 'rgba(245,158,11,0.1)', color: '#ea580c' };
      case 'normal':
        return { backgroundColor: 'rgba(59,130,246,0.1)', color: '#4b8eff' };
      default:
        return { backgroundColor: 'action.hover', color: 'text.secondary' };
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid', borderColor: 'divider',
        borderRadius: '8px',
        p: 2,
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {getStatusIcon()}
          <Box>
            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'text.primary' }}>
              {job.job_id}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{job.type}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <Chip size="small" label={job.status} sx={{ fontWeight: 600, fontSize: '0.7rem', textTransform: 'capitalize', ...getStatusChipSx() }} />
          <Chip size="small" label={job.priority} sx={{ fontWeight: 600, fontSize: '0.7rem', textTransform: 'capitalize', ...getPriorityChipSx() }} />
        </Box>
      </Box>

      {/* Timing Info */}
      {job.duration_ms && (
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
          Duration: {job.duration_ms}ms
          {job.wait_time_ms && ` | Wait: ${job.wait_time_ms}ms`}
        </Typography>
      )}

      {/* Worker ID */}
      {job.worker_id && (
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
          Worker: {job.worker_id}
        </Typography>
      )}

      {/* Result */}
      {job.result && (
        <Alert severity="success" sx={{ mt: 1.5, '& .MuiAlert-message': { fontSize: '0.8rem' } }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, mb: 0.5 }}>Result:</Typography>
          <Typography sx={{ fontSize: '0.8rem' }}>
            {JSON.stringify(job.result).substring(0, 100)}...
          </Typography>
        </Alert>
      )}

      {/* Error */}
      {job.error && (
        <Alert severity="error" sx={{ mt: 1.5, '& .MuiAlert-message': { fontSize: '0.8rem' } }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, mb: 0.5 }}>Error:</Typography>
          <Typography sx={{ fontSize: '0.8rem' }}>{job.error}</Typography>
        </Alert>
      )}

      {/* Actions */}
      {(job.status === 'pending' || job.status === 'queued' || job.status === 'running') && (
        <Button
          onClick={() => onCancel(job.job_id)}
          size="small"
          color="error"
          startIcon={<Trash2 size={14} />}
          sx={{ mt: 1.5, textTransform: 'none' }}
        >
          Cancel Job
        </Button>
      )}
    </Paper>
  );
}
