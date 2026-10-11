import React, { useState, useEffect } from 'react';
import {
  Database,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  ShieldAlert,
  Server,
  Layers,
} from 'lucide-react';
import api from '../api';

export default function PipelineCenterView({ user }) {
  const isAdmin = user?.role === 'admin';

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/etl-logs');
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load ETL logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadError('');
      setUploadResult(null);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setUploadError('');
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post('/etl/upload-incremental', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadResult(res.data);
      setSelectedFile(null);
      // Reset file input
      const input = document.getElementById('incremental-file-input');
      if (input) input.value = '';
      fetchLogs();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to process file upload.';
      setUploadError(detail);
    } finally {
      setUploading(false);
    }
  };

  const totalProcessed = logs.reduce((acc, curr) => acc + (curr.records_processed || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">ETL & Data Pipeline Operations Center</h2>
        <p className="text-xs text-slate-500 mt-1">
          Monitor batch ingestion health, run history, and upload incremental transaction batches
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pipeline Status</span>
            <div className="text-lg font-bold text-emerald-600 flex items-center gap-1.5 mt-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Operational / Active
            </div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Server className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Pipeline Records</span>
            <div className="text-xl font-bold text-slate-900 mt-2 font-mono">
              {totalProcessed.toLocaleString()} rows
            </div>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Audit Log Executions</span>
            <div className="text-xl font-bold text-slate-900 mt-2 font-mono">
              {logs.length} logged runs
            </div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Incremental File Upload Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UploadCloud className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Incremental Transaction Ingestion</h3>
          </div>
          {!isAdmin && (
            <span className="px-2.5 py-1 bg-amber-50 text-amber-800 text-[11px] font-semibold rounded-lg border border-amber-200 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Administrator Ingestion Only
            </span>
          )}
        </div>

        {uploadResult && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1 text-emerald-900">
            <div className="font-bold flex items-center gap-1.5 text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Batch Ingestion Completed Successfully
            </div>
            <p>File: <span className="font-mono font-semibold">{uploadResult.file_name}</span></p>
            <p>Records Read: <span className="font-mono font-semibold">{uploadResult.records_read}</span> | Cleaned: <span className="font-mono font-semibold">{uploadResult.records_cleaned}</span></p>
            <p>New Rows Inserted: <span className="font-mono font-semibold text-emerald-700">{uploadResult.records_inserted}</span></p>
            {uploadResult.duplicate_invoices_skipped > 0 && (
              <p className="text-amber-700">Duplicate Invoices Skipped: <span className="font-mono font-semibold">{uploadResult.duplicate_invoices_skipped}</span></p>
            )}
          </div>
        )}

        {uploadError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-6 text-center transition bg-slate-50/50">
            <FileSpreadsheet className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700 mb-1">
              Select or drag and drop a new batch file (.csv or .xlsx)
            </p>
            <p className="text-[11px] text-slate-400 mb-3">
              Automatically cleans schema, validates dates, maps dimensions, and prevents duplicate invoice insertion.
            </p>
            <input
              id="incremental-file-input"
              type="file"
              accept=".csv,.xlsx,.xls"
              disabled={!isAdmin || uploading}
              onChange={handleFileChange}
              className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!isAdmin || !selectedFile || uploading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Ingesting & Loading...
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" /> Start Incremental ETL Load
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">ETL Audit Log Execution History</h3>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Run ID</th>
                <th className="py-3 px-4">Source File</th>
                <th className="py-3 px-4">Target Sheet / Mode</th>
                <th className="py-3 px-4 text-right">Processed</th>
                <th className="py-3 px-4 text-right">Rejected</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Execution Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                    Loading pipeline audit records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                    No ETL execution history recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.run_id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-indigo-700">#{log.run_id}</td>
                    <td className="py-3 px-4 font-sans text-slate-800 font-medium">{log.file_name}</td>
                    <td className="py-3 px-4 font-sans text-slate-500">{log.sheet_name}</td>
                    <td className="py-3 px-4 text-right text-emerald-700 font-bold">
                      {log.records_processed.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">
                      {log.records_rejected.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-sans font-bold uppercase ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 font-sans text-[11px]">
                      {log.run_timestamp ? new Date(log.run_timestamp).toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
